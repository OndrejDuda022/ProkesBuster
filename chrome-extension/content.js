// Hlavní content script pro Google Forms Auto-fill
let questionsDatabase = [];
let config = { 
  similarityThreshold: 50, 
  questionSimilarityThreshold: 80, 
  showNoMatchIndicator: true 
};
let isActive = false;
let lastMouseX = window.innerWidth / 2;
let lastMouseY = window.innerHeight / 2;

// Sledování pozice myši
document.addEventListener('mousemove', (event) => {
  lastMouseX = event.clientX;
  lastMouseY = event.clientY;
});

// Načtení konfigurace
async function loadConfig() {
  try {
    const response = await fetch(chrome.runtime.getURL('config.json'));
    config = await response.json();
    console.log('Konfigurace načtena:', config);
  } catch (error) {
    console.error('Chyba při načítání konfigurace:', error);
    // Použít výchozí hodnoty
    config = { 
      similarityThreshold: 50, 
      questionSimilarityThreshold: 80, 
      showNoMatchIndicator: true 
    };
  }
}

// Načtení databáze otázek
async function loadQuestionsDatabase() {
  try {
    const response = await fetch(chrome.runtime.getURL('questions-db.json'));
    questionsDatabase = await response.json();
    console.log('Databáze otázek načtena:', questionsDatabase.length, 'otázek');
  } catch (error) {
    console.error('Chyba při načítání databáze otázek:', error);
  }
}

// Zobrazení červeného vykřičníku pro no-match
function showNoMatchIndicator() {
  if (!config.showNoMatchIndicator) return;
  
  // Odstranit existující indikátor
  const existing = document.getElementById('auto-fill-no-match-indicator');
  if (existing) existing.remove();
  
  // Vytvořit nový indikátor
  const indicator = document.createElement('div');
  indicator.id = 'auto-fill-no-match-indicator';
  indicator.innerHTML = '❗';
  indicator.title = 'Nebyla nalezena shoda v databázi';
  document.body.appendChild(indicator);
  
  // Automaticky odstranit po 1 sekundě
  setTimeout(() => {
    indicator.remove();
  }, 1000);
}

// Odstranění indikátoru no-match
function hideNoMatchIndicator() {
  const indicator = document.getElementById('auto-fill-no-match-indicator');
  if (indicator) indicator.remove();
}

// Normalizace textu pro porovnání
function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Odstranit diakritiku
    .replace(/[^\w\s\d]/gi, '') // Odstranit interpunkci
    .replace(/\s+/g, ' ') // Více mezer na jednu
    .trim();
}

// Extrakce všech čísel z textu
function extractNumbers(text) {
  const matches = text.match(/\d+/g);
  return matches ? matches.map(n => parseInt(n)) : [];
}

// Extrakce IP adres a ostatních čísel
function extractIPAddressesAndNumbers(text) {
  const result = {
    ipAddresses: [],
    otherNumbers: []
  };
  
  // Regex pro IPv4 adresy (podporuje i zkrácené notace jako 10.0.0 nebo 192.168.1)
  const ipv4Regex = /\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?:\.(\d{1,3}))?\b/g;
  
  // Najít všechny IP adresy a normalizovat je na 4 oktety
  let match;
  const ipPositions = [];
  while ((match = ipv4Regex.exec(text)) !== null) {
    const octets = [
      parseInt(match[1]),
      parseInt(match[2]),
      parseInt(match[3]),
      match[4] ? parseInt(match[4]) : 0  // Pokud chybí 4. oktet, doplnit 0
    ];
    result.ipAddresses.push(octets);
    ipPositions.push({ start: match.index, end: match.index + match[0].length });
  }
  
  // Najít všechna ostatní čísla (která nejsou součástí IP adres)
  const allNumberMatches = text.matchAll(/\d+/g);
  for (const numMatch of allNumberMatches) {
    const numStart = numMatch.index;
    const numEnd = numStart + numMatch[0].length;
    
    // Zkontrolovat, zda toto číslo není součástí IP adresy
    const isPartOfIP = ipPositions.some(ip => 
      numStart >= ip.start && numEnd <= ip.end
    );
    
    if (!isPartOfIP) {
      result.otherNumbers.push(parseInt(numMatch[0]));
    }
  }
  
  return result;
}

// Výpočet podobnosti dvou textů (Levenshtein distance)
function calculateSimilarity(str1, str2) {
  const s1 = normalizeText(str1);
  const s2 = normalizeText(str2);
  
  if (s1 === s2) return 100;
  
  const len1 = s1.length;
  const len2 = s2.length;
  
  if (len1 === 0) return len2 === 0 ? 100 : 0;
  if (len2 === 0) return 0;
  
  const matrix = [];
  
  for (let i = 0; i <= len2; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= len1; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= len2; i++) {
    for (let j = 1; j <= len1; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  const distance = matrix[len2][len1];
  const maxLen = Math.max(len1, len2);
  return ((maxLen - distance) / maxLen) * 100;
}

// Porovnání odpovědí se zaměřením na čísla a IP adresy
function compareAnswers(answer1, answer2) {
  const data1 = extractIPAddressesAndNumbers(answer1);
  const data2 = extractIPAddressesAndNumbers(answer2);
  
  console.log(`  DEBUG: IP adresy v odpovědi 1: ${JSON.stringify(data1.ipAddresses)}`);
  console.log(`  DEBUG: IP adresy v odpovědi 2: ${JSON.stringify(data2.ipAddresses)}`);
  console.log(`  DEBUG: Ostatní čísla v odpovědi 1: [${data1.otherNumbers.join(', ')}]`);
  console.log(`  DEBUG: Ostatní čísla v odpovědi 2: [${data2.otherNumbers.join(', ')}]`);
  
  // Porovnat IP adresy
  if (data1.ipAddresses.length > 0 || data2.ipAddresses.length > 0) {
    if (data1.ipAddresses.length !== data2.ipAddresses.length) {
      console.log(`  DEBUG: Různý počet IP adres (${data1.ipAddresses.length} vs ${data2.ipAddresses.length}) → 0%`);
      return 0;
    }
    
    for (let i = 0; i < data1.ipAddresses.length; i++) {
      const ip1 = data1.ipAddresses[i];
      const ip2 = data2.ipAddresses[i];
      
      for (let j = 0; j < 4; j++) {
        if (ip1[j] !== ip2[j]) {
          console.log(`  DEBUG: IP adresy se liší na pozici ${i}, oktet ${j} (${ip1.join('.')} vs ${ip2.join('.')}) → 0%`);
          return 0;
        }
      }
    }
    
    console.log(`  DEBUG: Všechny IP adresy se shodují ✓`);
  }
  
  // Porovnat ostatní čísla
  if (data1.otherNumbers.length > 0 || data2.otherNumbers.length > 0) {
    if (data1.otherNumbers.length !== data2.otherNumbers.length) {
      console.log(`  DEBUG: Různý počet ostatních čísel (${data1.otherNumbers.length} vs ${data2.otherNumbers.length}) → 0%`);
      return 0;
    }
    
    for (let i = 0; i < data1.otherNumbers.length; i++) {
      if (data1.otherNumbers[i] !== data2.otherNumbers[i]) {
        console.log(`  DEBUG: Ostatní čísla se liší na pozici ${i} (${data1.otherNumbers[i]} vs ${data2.otherNumbers[i]}) → 0%`);
        return 0;
      }
    }
    
    console.log(`  DEBUG: Všechna ostatní čísla se shodují ✓`);
  }
  
  // Porovnání slov (bez čísel a IP adres)
  const words1 = normalizeText(answer1).split(' ').filter(w => !w.match(/^\d+$/));
  const words2 = normalizeText(answer2).split(' ').filter(w => !w.match(/^\d+$/));
  
  // Pokud jsou IP/čísla stejná a slova taky, je to perfektní shoda
  if (data1.ipAddresses.length === data2.ipAddresses.length && 
      data1.otherNumbers.length === data2.otherNumbers.length &&
      words1.join(' ') === words2.join(' ')) {
    return 100;
  }
  
  // Jinak počítáme podobnost slov
  return calculateSimilarity(words1.join(' '), words2.join(' '));
}

// Získání textu otázky z elementu
function getQuestionText(element) {
  // Hledání nadpisu otázky v Google Forms
  const questionTitle = element.querySelector('[role="heading"]') || 
                       element.querySelector('.freebirdFormviewerComponentsQuestionBaseTitle') ||
                       element.querySelector('.Qr7Oae');
  
  return questionTitle ? questionTitle.textContent.trim() : null;
}

// Získání možností odpovědí
function getAnswerOptions(element) {
  const answers = [];
  
  console.log('Hledám odpovědi v elementu:', element);
  
  // Radio buttons (jedna možnost)
  const radioOptions = element.querySelectorAll('[role="radio"]');
  console.log('Nalezeno radio options:', radioOptions.length);
  
  // Pokud máme hodně radio buttonů, může jít o grid
  const mightBeGrid = radioOptions.length > 6;
  
  if (!mightBeGrid) {
    // Standardní radio buttons
    radioOptions.forEach(option => {
      // Zkusit různé způsoby získání textu
      let text = null;
      
      // Způsob 1: aria-label
      text = option.getAttribute('aria-label');
      
      // Způsob 2: textContent child elementů
      if (!text) {
        const label = option.querySelector('.aDTYNe') || 
                     option.querySelector('span') ||
                     option.querySelector('[class*="export"]') ||
                     option.querySelector('[data-value]');
        if (label) text = label.textContent.trim();
      }
      
      // Způsob 3: textContent celého radio buttonu
      if (!text && option.textContent.trim()) {
        text = option.textContent.trim();
      }
      
      // Způsob 4: následující sourozenec (label)
      if (!text) {
        const nextLabel = option.nextElementSibling;
        if (nextLabel) text = nextLabel.textContent.trim();
      }
      
      // Způsob 5: parent container
      if (!text) {
        const container = option.closest('.docssharedWizToggleLabeledContainer') ||
                         option.closest('label');
        if (container) text = container.textContent.trim();
      }
      
      if (text && text.length > 0) {
        console.log('  Radio odpověď:', text);
        answers.push({
          element: option,
          text: text,
          type: 'radio'
        });
      } else {
        console.log('  Radio button bez textu (skipped):', option);
      }
    });
  }
  
  // Checkboxes (více možností)
  const checkboxOptions = element.querySelectorAll('[role="checkbox"]');
  console.log('Nalezeno checkbox options:', checkboxOptions.length);
  checkboxOptions.forEach(option => {
    // Zkusit různé způsoby získání textu
    let text = null;
    
    // Způsob 1: aria-label (bez "odpověď pro řádek" části pro non-grid)
    const ariaLabel = option.getAttribute('aria-label');
    if (ariaLabel && !ariaLabel.includes('odpověď pro řádek')) {
      text = ariaLabel;
    }
    
    // Způsob 2: textContent child elementů
    if (!text) {
      const label = option.querySelector('.aDTYNe') || 
                   option.querySelector('span') ||
                   option.querySelector('[class*="export"]') ||
                   option.querySelector('[data-value]');
      if (label) text = label.textContent.trim();
    }
    
    // Způsob 3: parent container
    if (!text) {
      const container = option.closest('.docssharedWizToggleLabeledContainer') ||
                       option.closest('label');
      if (container) text = container.textContent.trim();
    }
    
    if (text && text.length > 0) {
      console.log('  Checkbox odpověď:', text);
      answers.push({
        element: option,
        text: text,
        type: 'checkbox'
      });
    }
  });
  
  // Dropdown menu (rozbalovaocí nabídka)
  const selectElement = element.querySelector('select');
  if (selectElement) {
    console.log('Nalezen dropdown select');
    const options = selectElement.querySelectorAll('option');
    options.forEach(option => {
      const text = option.textContent.trim();
      if (text && text !== 'Vybrat' && text !== 'Choose') {
        console.log('  Dropdown odpověď:', text);
        answers.push({
          element: option,
          text: text,
          type: 'dropdown',
          selectElement: selectElement
        });
      }
    });
  }
  
  // Mřížkové otázky (grid questions) - radio buttony i checkboxy
  // Zkusit najít tabulkovou strukturu nebo pokud máme hodně radio buttonů nebo checkboxů
  const hasGridStructure = radioOptions.length > 6 || checkboxOptions.length > 6;
  
  if (hasGridStructure) {
    console.log('Detekuji možnou mřížkovou otázku (mnoho prvků)');
    
    // Získat názvy sloupců - zkusit různé způsoby
    let columns = [];
    
    // Způsob 1: role="columnheader"
    const columnHeaders1 = element.querySelectorAll('[role="columnheader"]');
    if (columnHeaders1.length > 0) {
      columns = Array.from(columnHeaders1).map(h => h.textContent.trim());
    }
    
    // Způsob 2: hledat v thead nebo table struktuře
    if (columns.length === 0) {
      const tableHeaders = element.querySelectorAll('thead th, .freebirdFormviewerComponentsQuestionGridColumnHeader');
      if (tableHeaders.length > 0) {
        columns = Array.from(tableHeaders).map(h => h.textContent.trim());
      }
    }
    
    // Způsob 3: najít první radiogroup nebo group a spočítat počet prvků
    if (columns.length === 0) {
      const firstGroup = element.querySelector('[role="radiogroup"], [role="group"]');
      if (firstGroup) {
        const itemsInGroup = firstGroup.querySelectorAll('[role="radio"], [role="checkbox"]');
        // Vytvořit názvy sloupců z aria-labelů
        for (let i = 0; i < itemsInGroup.length; i++) {
          // Zkusit získat aria-label a vyčistit ho
          let ariaLabel = itemsInGroup[i].getAttribute('aria-label');
          if (ariaLabel) {
            // Odstranit ", odpověď pro řádek ..." a podobný text
            ariaLabel = ariaLabel.split(',')[0].trim();
            columns.push(ariaLabel);
          } else {
            columns.push(`Sloupec ${i + 1}`);
          }
        }
      }
    }
    
    console.log('Sloupce:', columns);
    
    if (columns.length > 0) {
      // Najít řádky - hledat radiogroup i group (pro checkboxy)
      const gridRows = element.querySelectorAll('[role="radiogroup"], [role="group"]');
      console.log('Nalezeno mřížkových řádků:', gridRows.length);
      
      gridRows.forEach((row, rowIndex) => {
        // Získat název řádku - zkusit různé způsoby
        let rowText = null;
        
        console.log('DEBUG: Zpracovávám řádek', rowIndex, row);
        
        // Způsob 1: aria-label na group
        rowText = row.getAttribute('aria-label');
        console.log('  Způsob 1 (aria-label):', rowText);
        
        // Způsob 2: heading element uvnitř
        if (!rowText) {
          const rowHeading = row.querySelector('[role="heading"]');
          if (rowHeading) rowText = rowHeading.textContent.trim();
          console.log('  Způsob 2 (heading):', rowText);
        }
        
        // Způsob 3: předchozí sourozenec (často obsahuje label)
        if (!rowText) {
          let prevElement = row.previousElementSibling;
          // Zkusit několik předchozích elementů
          for (let i = 0; i < 3 && prevElement; i++) {
            const text = prevElement.textContent.trim();
            console.log(`  Způsob 3.${i} (prevSibling):`, text.substring(0, 50));
            // Ignorovat text, který vypadá jako spojení všech sloupců
            if (text && text.length < 100 && !columns.every(col => text.includes(col))) {
              rowText = text;
              console.log('  -> Vybráno!');
              break;
            }
            prevElement = prevElement.previousElementSibling;
          }
        }
        
        // Způsob 4: parent element s data-atributy nebo specifickou třídou
        if (!rowText) {
          const parent = row.closest('[data-row-label], .freebirdFormviewerComponentsQuestionGridRowHeader');
          if (parent) {
            rowText = parent.getAttribute('data-row-label') || parent.textContent.trim();
            console.log('  Způsob 4 (parent):', rowText);
          }
        }
        
        // Způsob 5: hledat label nebo span těsně před row
        if (!rowText) {
          const parentContainer = row.parentElement;
          if (parentContainer) {
            const labels = parentContainer.querySelectorAll('label, span, div');
            for (const label of labels) {
              const text = label.textContent.trim();
              if (text && text.length > 0 && text.length < 100 && 
                  !columns.every(col => text.includes(col)) &&
                  !label.contains(row)) {
                rowText = text;
                console.log('  Způsob 5 (parent labels):', text.substring(0, 50));
                break;
              }
            }
          }
        }
        
        if (!rowText || rowText.length > 100) {
          rowText = `Řádek ${rowIndex + 1}`;
        }
        
        rowText = rowText.trim();
        console.log('  FINÁLNÍ název řádku:', rowText);
        
        // Získat radio buttony nebo checkboxy v tomto řádku
        const rowItems = row.querySelectorAll('[role="radio"], [role="checkbox"]');
        
        if (rowItems.length > 0) {
          const itemType = rowItems[0].getAttribute('role');
          
          // Pro checkboxy, zkusit získat název řádku z aria-label prvního checkboxu
          if (itemType === 'checkbox' && rowItems.length > 0) {
            const firstAriaLabel = rowItems[0].getAttribute('aria-label');
            if (firstAriaLabel && firstAriaLabel.includes('odpověď pro řádek')) {
              const match = firstAriaLabel.match(/odpověď pro řádek (.+)$/);
              if (match && match[1]) {
                rowText = match[1].trim();
                console.log(`  Přepsán název řádku z aria-label: "${rowText}"`);
              }
            }
          }
          
          console.log(`  Řádek "${rowText}" má ${rowItems.length} ${itemType === 'checkbox' ? 'checkboxů' : 'radio buttonů'}`);
          
          rowItems.forEach((item, colIndex) => {
            const columnText = columns[colIndex] || `Sloupec ${colIndex + 1}`;
            
            console.log(`    Grid odpověď: "${rowText}" -> "${columnText}"`);
            
            answers.push({
              element: item,
              text: `${rowText}: ${columnText}`,
              type: 'grid',
              rowText: rowText,
              columnText: columnText
            });
          });
        }
      });
    }
  }
  
  // Pokud nenajdeme nic (a nejde o grid), zkusíme alternativní přístup
  if (answers.length === 0 && !hasGridStructure) {
    console.log('Zkouším alternativní selektory...');
    const allLabels = element.querySelectorAll('[data-value], .docssharedWizToggleLabeledContainer');
    console.log('Nalezeno alternativních labelů:', allLabels.length);
    allLabels.forEach(label => {
      const text = label.textContent.trim();
      if (text && text.length > 0) {
        console.log('  Alt odpověď:', text);
        answers.push({
          element: label,
          text: text,
          type: 'unknown'
        });
      }
    });
  }
  
  return answers;
}

// Zpracování otázky
function processQuestion(questionElement) {
  const questionText = getQuestionText(questionElement);
  if (!questionText) {
    console.log('Nebyl nalezen text otázky');
    return;
  }
  
  console.log('Otázka:', questionText);
  
  // Najít shodu v databázi - DŮLEŽITÉ: prohledat VŠECHNY a vybrat nejlepší
  let bestMatch = null;
  let bestSimilarity = 0;
  
  for (const dbQuestion of questionsDatabase) {
    const similarity = calculateSimilarity(questionText, dbQuestion.question);
    console.log(`  Porovnání s DB: "${dbQuestion.question.substring(0, 50)}..." - ${similarity.toFixed(1)}%`);
    
    // Vybrat tu s nejvyšší podobností (ne první, která překročí threshold!)
    if (similarity > bestSimilarity) {
      bestMatch = dbQuestion;
      bestSimilarity = similarity;
    }
  }
  
  // Ověřit threshold až po výběru nejlepší
  if (!bestMatch || bestSimilarity < config.questionSimilarityThreshold) {
    console.log(`Nebyla nalezena shoda v databázi (nejlepší: ${bestSimilarity.toFixed(1)}%, min. ${config.questionSimilarityThreshold}%)`);
    showNoMatchIndicator();
    return;
  }
  
  // Skrýt indikátor, pokud byl zobrazen
  hideNoMatchIndicator();
  
  console.log(`Nalezena shoda: ${bestSimilarity.toFixed(1)}%`);
  
  // Správné odpovědi mohou být string nebo array
  const correctAnswers = Array.isArray(bestMatch.correctAnswer) 
    ? bestMatch.correctAnswer 
    : [bestMatch.correctAnswer];
  
  console.log('Správné odpovědi:', correctAnswers);
  
  // Získat možnosti odpovědí
  const answerOptions = getAnswerOptions(questionElement);
  if (answerOptions.length === 0) {
    console.log('Nebyly nalezeny možnosti odpovědí');
    return;
  }
  
  console.log('Nalezeno odpovědí:', answerOptions.length);
  
  // Detekce mřížkových otázek
  const isGridQuestion = answerOptions.some(opt => opt.type === 'grid');
  
  if (isGridQuestion) {
    console.log('Detekovaná mřížková otázka');
    // Pro mřížkové otázky - correctAnswer by mělo být objekt {"Rádek": "Sloupec"} nebo {"Rádek": ["Sloupec1", "Sloupec2"]}
    if (typeof bestMatch.correctAnswer === 'object' && !Array.isArray(bestMatch.correctAnswer)) {
      console.log('Mřížková odpověď (objekt):', bestMatch.correctAnswer);
      
      const matchedAnswers = [];
      
      // Pro každý řádek v správné odpovědi
      for (const [rowKey, columnValue] of Object.entries(bestMatch.correctAnswer)) {
        // columnValue může být string nebo array
        const columnValues = Array.isArray(columnValue) ? columnValue : [columnValue];
        
        // Pro každou hodnotu sloupce v tomto řádku
        for (const colVal of columnValues) {
          let bestRowMatch = null;
          let bestSimilarity = 0;
          
          // Najít odpovídající buňku v mřížce
          for (const option of answerOptions) {
            if (option.type !== 'grid') continue;
            
            // Porovnat řádek a sloupec
            const rowSimilarity = calculateSimilarity(option.rowText, rowKey);
            const colSimilarity = calculateSimilarity(option.columnText, colVal);
            
            // Oba musí být vysoké
            if (rowSimilarity > 70 && colSimilarity > 70) {
              const avgSimilarity = (rowSimilarity + colSimilarity) / 2;
              console.log(`  Grid shoda: "${option.rowText}" vs "${rowKey}" (${rowSimilarity.toFixed(0)}%), "${option.columnText}" vs "${colVal}" (${colSimilarity.toFixed(0)}%)`);
              
              if (avgSimilarity > bestSimilarity) {
                bestSimilarity = avgSimilarity;
                bestRowMatch = option;
              }
            }
          }
          
          if (bestRowMatch) {
            console.log(`Grid nalezen: ${bestRowMatch.rowText} -> ${bestRowMatch.columnText}`);
            matchedAnswers.push(bestRowMatch);
          }
        }
      }
      
      // Zvýraznit všechny nalezené grid odpovědi
      if (matchedAnswers.length > 0) {
        matchedAnswers.forEach(answer => {
          highlightAnswer(answer.element, answer.type);
        });
      }
      return;
    }
  }
  
  // Standardní zpracování pro non-grid otázky
  // Najít všechny odpovědi, které odpovídají správným
  const matchedAnswers = [];
  
  for (const correctAnswer of correctAnswers) {
    let bestAnswerMatch = null;
    let bestAnswerSimilarity = 0;
    
    for (const option of answerOptions) {
      const similarity = compareAnswers(option.text, correctAnswer);
      console.log(`  "${option.text}" vs "${correctAnswer}" - shoda: ${similarity.toFixed(1)}%`);
      
      if (similarity > bestAnswerSimilarity) {
        bestAnswerMatch = option;
        bestAnswerSimilarity = similarity;
      }
    }
    
    // Použít threshold pro odpovědi (nižší než pro otázky)
    if (bestAnswerMatch && bestAnswerSimilarity >= config.similarityThreshold) {
      console.log(`Nalezena odpověď: ${bestAnswerMatch.text} (${bestAnswerSimilarity.toFixed(1)}%)`);
      matchedAnswers.push(bestAnswerMatch);
    }
  }
  
  // Zvýraznit všechny nalezené odpovědi
  if (matchedAnswers.length > 0) {
    matchedAnswers.forEach(answer => {
      highlightAnswer(answer.element, answer.type);
    });
  }
}

// Zvýraznění odpovědi
function highlightAnswer(answerElement, answerType = 'radio') {
  console.log('Zvýrazňuji element:', answerElement, 'typ:', answerType);
  
  // Pro dropdown zvláštní způsob
  if (answerType === 'dropdown') {
    // Ztučnit text v option elementu
    answerElement.style.fontWeight = '900';
    
    // Najít select element a zvýraznit ho tež
    const selectElement = answerElement.closest('select') || answerElement.parentElement;
    if (selectElement && selectElement.tagName === 'SELECT') {
      // Viditelné zvýraznění select boxu
      selectElement.style.fontWeight = '900';
      selectElement.style.outline = '2px solid #ffc107';
      selectElement.classList.add('auto-fill-highlight');
      
      console.log('Dropdown select box zvýrazněn');
      
      // Odstranit po 1 sekundě
      setTimeout(() => {
        selectElement.style.fontWeight = '';
        selectElement.style.outline = '';
        selectElement.classList.remove('auto-fill-highlight');
        answerElement.style.fontWeight = '';
        console.log('Dropdown zvýraznění odstraněno');
      }, 1000);
    } else {
      // Fallback - pouze option
      console.log('Dropdown odpověď zvýrazněna');
      setTimeout(() => {
        answerElement.style.fontWeight = '';
        console.log('Dropdown zvýraznění odstraněno');
      }, 1000);
    }
    return;
  }
  
  // Pro grid - zvýraznit celý radio button
  if (answerType === 'grid') {
    // Aplikovat pouze černé ohraničení
    answerElement.style.outline = '1px solid #000';
    answerElement.style.outlineOffset = '1px';
    answerElement.style.transition = 'all 0.3s ease';
    
    console.log('Grid buňka zvýrazněna');
    
    // Odstranit po 1 sekundě
    setTimeout(() => {
      answerElement.style.outline = '';
      answerElement.style.outlineOffset = '';
      console.log('Grid zvýraznění odstraněno');
    }, 1000);
    return;
  }
  
  // Pro radio a checkbox
  const questionContainer = answerElement.closest('[role="listitem"]') || 
                           answerElement.closest('.freebirdFormviewerComponentsQuestionBaseRoot');
  
  // Najít parent kontejner odpovědi
  const container = answerElement.closest('.docssharedWizToggleLabeledContainer') ||
                   answerElement.closest('[class*="Container"]') ||
                   answerElement.closest('label') ||
                   answerElement;
  
  // Přidat zvýraznění
  container.classList.add('auto-fill-highlight');
  
  // Aplikovat tučné písmo na všechny vnořené elementy
  container.querySelectorAll('*').forEach(child => {
    child.style.fontWeight = '900';
  });
  
  console.log('Text ztučněn');
  
  // Odstranit ztučnění po 1 sekundě
  setTimeout(() => {
    container.classList.remove('auto-fill-highlight');
    container.querySelectorAll('*').forEach(child => {
      child.style.fontWeight = '';
    });
    console.log('Ztučnění odstraněno');
  }, 1000);
}

// Zrušení všech zvýraznění
function clearAllHighlights() {
  console.log('Rušení všech ztučnění...');
  
  // Zrušit zvýraznění radio/checkbox
  document.querySelectorAll('.auto-fill-highlight').forEach(el => {
    el.classList.remove('auto-fill-highlight');
    el.querySelectorAll('*').forEach(child => {
      child.style.fontWeight = '';
    });
    // Pro select elementy
    if (el.tagName === 'SELECT') {
      el.style.outline = '';
    }
  });
  
  // Zrušit zvýraznění všech selectů a optionů
  document.querySelectorAll('select, option').forEach(el => {
    el.style.fontWeight = '';
    el.style.outline = '';
  });
  
  // Zrušit grid ohraničení
  document.querySelectorAll('[role="radio"]').forEach(el => {
    el.style.outline = '';
    el.style.outlineOffset = '';
  });
  
  console.log('Všechna ztučnění zrušena');
}

// Najít otázku pod kurzorem myši
function findNearestQuestion(mouseElement) {
  console.log('Hledám otázku pod kurzorem...');
  
  // Zkusit najít otázku z elementu pod kurzorem
  if (mouseElement) {
    let questionContainer = mouseElement.closest('[role="listitem"]') ||
                           mouseElement.closest('.freebirdFormviewerComponentsQuestionBaseRoot') ||
                           mouseElement.closest('[data-params]');
    
    if (questionContainer) {
      console.log('Našel jsem otázku pod kurzorem');
      return questionContainer;
    }
  }
  
  // Pokud pod kurzorem není otázka, najít nejbližší
  const allQuestions = document.querySelectorAll('[role="listitem"]');
  console.log(`Nalezeno celkem ${allQuestions.length} otázek`);
  
  if (allQuestions.length === 0) {
    return null;
  }
  
  let nearestQuestion = null;
  let smallestDistance = Infinity;
  
  // Najít otázku nejblíže pozici kurzoru
  for (const question of allQuestions) {
    const rect = question.getBoundingClientRect();
    
    // Kontrola, zda je otázka aspoň částečně viditelná
    if (rect.bottom < 0 || rect.top > window.innerHeight) {
      continue;
    }
    
    // Vypočítat střed otázky
    const questionCenterX = rect.left + rect.width / 2;
    const questionCenterY = rect.top + rect.height / 2;
    
    // Vzdálenost od kurzoru
    const dx = questionCenterX - lastMouseX;
    const dy = questionCenterY - lastMouseY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < smallestDistance) {
      smallestDistance = distance;
      nearestQuestion = question;
    }
  }
  
  if (nearestQuestion) {
    console.log(`Našel jsem nejbližší otázku (vzdálenost: ${smallestDistance.toFixed(0)}px)`);
  } else {
    console.log('Nebyla nalezena žádná viditelná otázka');
  }
  
  return nearestQuestion;
}

// Obsluha klávesové zkratky
function handleKeyPress(event) {
  // Klávesa I pro aktivaci
  if (event.key === 'i' || event.key === 'I') {
    // Pouze pokud není focus v input poli
    if (document.activeElement.tagName === 'INPUT' || 
        document.activeElement.tagName === 'TEXTAREA' ||
        document.activeElement.isContentEditable) {
      return;
    }
    
    event.preventDefault();
    
    // Získat element pod aktuální pozicí kurzoru
    const mouseElement = document.elementFromPoint(lastMouseX, lastMouseY);
    
    const questionElement = findNearestQuestion(mouseElement);
    
    if (questionElement) {
      console.log('=== Zpracování otázky ===');
      processQuestion(questionElement);
    } else {
      console.log('Nebyl nalezen žádný element otázky');
      showNoMatchIndicator();
    }
  }
  
  // Klávesa O pro zrušení všech zvýraznění
  if (event.key === 'o' || event.key === 'O') {
    // Pouze pokud není focus v input poli
    if (document.activeElement.tagName === 'INPUT' || 
        document.activeElement.tagName === 'TEXTAREA' ||
        document.activeElement.isContentEditable) {
      return;
    }
    
    event.preventDefault();
    clearAllHighlights();
  }
}

// Inicializace
async function init() {
  console.log('Google Forms Auto-fill Extension aktivováno');
  await loadConfig();
  await loadQuestionsDatabase();
  
  // Posluchač klávesnice
  document.addEventListener('keydown', handleKeyPress);
  
  console.log('Stiskněte klávesu I pro analýzu otázky');
  console.log(`Práh podobnosti: ${config.similarityThreshold}%`);
}

// Spuštění po načtení stránky
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
