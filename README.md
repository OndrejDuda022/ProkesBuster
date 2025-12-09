# ProkesBuster - Google Forms Auto-fill Extension

Chrome rozšíření pro automatické vyplňování Google formulářů s inteligentním porovnáváním otázek a odpovědí.

## Funkce

- **Detekce pod kurzorem**: Při stisku klávesy **I** rozšíření analyzuje otázku pod kurzorem myši
- **Inteligentní porovnání**: Porovnává text otázky s databází (threshold 80%)
- **Normalizace textu**: Odstraňuje diakritiku a interpunkci pro lepší rozpoznávání
- **Přesná čísla**: Čísla v odpovědích musí být přesně stejná
- **Podobnost slov**: Slova se porovnávají s tolerancí pomocí Levenshteinovy vzdálenosti
- **Podpora více typů otázek**:
  - **Radio buttons** (jedna správná odpověď) - tučné písmo
  - **Checkboxes** (více správných odpovědí) - tučné písmo
  - **Rozbalovací nabídka** (dropdown) - tučné písmo
  - **Mřížkové otázky** (grid) - černé ohraničení 1px
    - Radio buttony (1 odpověď na řádek)
    - Checkboxy (více odpovědí na řádek)
- **No-match indikátor**: Malý červený vykřičník (20px) uprostřed dole při nenalezení shody (konfigurovatelné)
- **Automatické zmizení**: Všechna zvýraznění zmizí po 1 sekundě
- **Ruční zrušení**: Klávesa **O** okamžitě zruší všechna zvýraznění
- **Konfigurovatelný práh**: Nastavitelné procento podobnosti v `config.json`

## Instalace

1. Otevřete Chrome a přejděte na `chrome://extensions/`
2. Zapněte **"Režim pro vývojáře"** (Developer mode) v pravém horním rohu
3. Klikněte na **"Načíst rozbalené rozšíření"** (Load unpacked)
4. Vyberte složku `chrome-extension` z tohoto projektu

## Použití

### Základní workflow:
1. Otevřete Google formulář (https://docs.google.com/forms/)
2. **Najeďte myší na otázku**, kterou chcete zkontrolovat
3. Stiskněte **klávesu I** - rozšíření:
   - Detekuje otázku pod kurzorem
   - Najde shodu v databázi (pokud existuje s ≥80% podobností)
   - Zvýrazní správnou odpověď/odpovědi
4. (Volitelně) Stiskněte **klávesu O** pro okamžité zrušení zvýraznění

> **Poznámka:** Klávesy se deaktivují ve vstupních polích (input/textarea)

## Konfigurace

Rozšíření používá konfigurační soubor `chrome-extension/config.json`:

```json
{
  "similarityThreshold": 80,
  "showNoMatchIndicator": true
}
```

### Parametry:
- **similarityThreshold** (výchozí: 80)
  - Minimální procentuální shoda pro otázky
  - Rozsah: 0-100
  - Nižší hodnota = více false positives
  - Vyšší hodnota = více false negatives

- **questionSimilarityTreshold** (to samé pro odpovědi)
  
- **showNoMatchIndicator** (výchozí: true)
  - Zobrazit červený vykřičník při nenalezení shody
  - `true` = zobrazit, `false` = skrýt

## Databáze otázek

Otázky a správné odpovědi jsou uloženy v `chrome-extension/questions-db.json`.

### Podporované formáty:

#### 1. Jedna správná odpověď (radio button):
```json
{
  "question": "Jaké je hlavní město České republiky?",
  "correctAnswer": "Praha"
}
```

#### 2. Více správných odpovědí (checkboxy):
```json
{
  "question": "Které země leží v Evropě?",
  "correctAnswer": ["Česko", "Německo", "Francie", "Španělsko"]
}
```

#### 3. Mřížkové otázky - jedna odpověď na řádek (radio grid):
```json
{
  "question": "Ohodnoťte následující programovací jazyky",
  "correctAnswer": {
    "Python": "Vynikající",
    "JavaScript": "Dobrý",
    "Java": "Průměrný"
  }
}
```

#### 4. Mřížkové otázky - více odpovědí na řádek (checkbox grid):
```json
{
  "question": "Označte vlastnosti, které se vám líbí",
  "correctAnswer": {
    "Design": ["Moderní", "Minimalistický"],
    "Funkcionalita": "Komplexní",
    "Rychlost": ["Rychlá", "Optimalizovaná"]
  }
}
```

### Přidání nových otázek:
1. Otevřete `chrome-extension/questions-db.json`
2. Přidejte nový objekt do JSON pole
3. Uložte soubor
4. Obnovte stránku Google Forms (F5)

## Technické detaily

- **Manifest V3**: Nejnovější verze Chrome Extensions API
- **Content Script**: Běží přímo na stránce Google Forms
- **Injekce**: `chrome-extension/content.js` se načte na `docs.google.com/forms/*`
- **Algoritmus**: Levenshteinova vzdálenost pro fuzzy text matching
- **DOM Selektory**: Používá ARIA role attributes (`role="radio"`, `role="heading"`, atd.)
- **Text normalizace**: Unicode NFD normalizace + regex cleanup
- **Mouse tracking**: Global `mousemove` listener ukládá `lastMouseX`/`lastMouseY`
## Struktura projektu

```
ProkesBuster/
├── chrome-extension/
│   ├── manifest.json       # Chrome extension config (Manifest V3)
│   ├── content.js          # Hlavní logika (~780 řádků)
│   ├── styles.css          # CSS styly pro zvýraznění
│   ├── config.json         # Konfigurace (threshold, indicators)
│   └── questions-db.json   # Databáze otázek a odpovědí
└── README.md               # Tato dokumentace
```

## Vývoj a ladění

### Debug mode:
- Otevřete DevTools (F12) → Console
- Všechny operace logují do konzole:
  - `Hledám otázku pod kurzorem...`
  - `Otázka: <text>`
  - `Nalezena shoda: <X>%`
  - `Grid shoda: ...`
  - atd.

### Úprava kódu:
1. Upravte soubory v `chrome-extension/`
2. Přejděte na `chrome://extensions/`
3. Klikněte na **⟳ Obnovit** (Reload) u rozšíření
4. Obnovte stránku Google Forms (F5)
