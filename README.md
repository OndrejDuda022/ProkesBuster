# ProkesBuster - Google Forms Hint Extension

Chrome rozšíření pro automatické vyplňování Google formulářů s inteligentním porovnáváním otázek a odpovědí.

## ⚙️ Aktuální nastavení

- **Práh pro otázky**: 70% (upravitelné klávesou P)
- **Práh pro odpovědi**: 60% (upravitelné klávesou P)
- **Počet otázek v databázi**: 78
- **Velikost kódu**: ~979 řádků (content.js), ~117 řádků (styles.css)

## Funkce

### 🎯 Detekce a porovnávání
- **Detekce pod kurzorem**: Při stisku klávesy **I** rozšíření analyzuje otázku pod kurzorem myši
- **Inteligentní algoritmus**: Prohledá VŠECHNY otázky v databázi a vybere tu s nejvyšší podobností
- **Dva prahy podobnosti**: 
  - 70% pro otázky (přesná detekce)
  - 60% pro odpovědi (tolerantnější pro překlady)
- **Normalizace textu**: Automatické odstranění diakritiky a interpunkce (NFD normalizace)
- **IP adresy**: Inteligentní detekce IPv4 s normalizací (10.0.0 = 10.0.0.0)
- **Přesná čísla**: Všechna čísla musí být identická včetně pořadí

### 📝 Podporované typy otázek
- **Radio buttons** (jedna odpověď) - zvýraznění tučným písmem (font-weight: 900)
- **Checkboxes** (více odpovědí) - zvýraznění tučným písmem
- **Dropdown** - tučné písmo
- **Grid/Mřížka** (radio) - černý obrys 1px na správných buňkách
- **Grid/Mřížka** (checkbox) - černý obrys 1px, podporuje více odpovědí na řádek

### 🎨 Vizuální feedback
- **Automatické zmizení**: Všechna zvýraznění zmizí po 1 sekundě
- **Animace**: Jemný pulse efekt při zvýraznění (scale 1.01)
- **No-match indikátor**: Červený kroužek s vykřičníkem (35px) uprostřed dole

### ⌨️ Klávesové zkratky
- **I** - Analyzovat otázku pod kurzorem
- **O** - Okamžitě zrušit všechna zvýraznění
- **P** - Zobrazit/skrýt nastavovací panel
  - Změna prahů v reálném čase
  - Nenápadný panel v pravém dolním rohu
  - Změny platí okamžitě bez restartu

## 📦 Instalace

1. Otevřete Chrome a přejděte na `chrome://extensions/`
2. Zapněte **"Režim pro vývojáře"** (Developer mode) v pravém horním rohu
3. Klikněte na **"Načíst rozbalené rozšíření"** (Load unpacked)
4. Vyberte složku `chrome-extension` z tohoto projektu
5. Rozšíření "PowerMove" se objeví v seznamu (interní název)

## 🚀 Použití

### Základní workflow:
1. Otevřete Google formulář (https://docs.google.com/forms/)
2. **Najeďte myší na otázku**, kterou chcete zkontrolovat
3. Stiskněte **klávesu I**:
   - Rozšíření detekuje otázku pod kurzorem
   - Prohledá všech 78 otázek v databázi
   - Najde otázku s nejvyšší podobností
   - Pokud shoda ≥70%, porovná odpovědi
   - Zvýrazní odpovědi s podobností ≥60%
4. Zvýraznění **zmizí automaticky po 1 sekundě**
5. Pro ruční zrušení stiskněte **klávesu O**

### Nastavení prahů (klávesa P):
- Stiskněte **P** → objeví se panel v pravém dolním rohu
- Upravte hodnoty:
  - **Otázky**: 0-100% (výchozí 70%)
  - **Odpovědi**: 0-100% (výchozí 60%)
- Změny platí okamžitě
- Panel skryjete opět klávesou **P**

> **💡 Tip**: Nižší práh = více shod (ale možné false positives). Vyšší práh = přesnější (ale možné false negatives).

## ⚙️ Konfigurace

Soubor `chrome-extension/config.json`:

```json
{
  "similarityThreshold": 60,
  "questionSimilarityThreshold": 70,
  "showNoMatchIndicator": true
}
```

### Parametry:
- **questionSimilarityThreshold** (aktuálně: 70)
  - Minimální shoda pro **otázky**
  - Rozsah: 0-100
  - Lze měnit klávesou **P**

- **similarityThreshold** (aktuálně: 60)
  - Minimální shoda pro **odpovědi**
  - Rozsah: 0-100
  - Lze měnit klávesou **P**
  
- **showNoMatchIndicator** (aktuálně: true)
  - Zobrazit červený kroužek při nenalezení shody
  - `true` / `false`

> **Proč dva prahy?** Otázky jsou stabilní, odpovědi mohou být přeložené nebo lehce upravené. Oddělené prahy = přesná detekce + tolerantní porovnání.

## 📚 Databáze otázek

Soubor `chrome-extension/questions-db.json` obsahuje **78 otázek** různých typů.

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
- **IP normalizace**: Regex detekce IPv4 adres s automatickou normalizací na 4 oktety
- **Čísla**: Extrahuje všechna čísla jako sekvence, IP adresy zpracovává zvlášť
- **Mouse tracking**: Global `mousemove` listener ukládá `lastMouseX`/`lastMouseY`
- **Best match**: Prohledá celou databázi a vybere otázku s nejvyšší podobností (ne první nad prahem)
- **Fallback detekce**: 5 metod pro detekci textu odpovědí:
  1. `aria-label` atribut
  2. Child elements (`span.aDTYNe`, `div.bzfPab`)
  3. `textContent` celého elementu
  4. `nextSibling` label element
  5. Parent container průchod
## Struktura projektu

```
ProkesBuster/
├── chrome-extension/
│   ├── manifest.json       # Chrome extension config (Manifest V3)
│   ├── content.js          # Hlavní logika (~990 řádků)
│   ├── styles.css          # CSS styly pro zvýraznění + nastavovací panel
│   ├── config.json         # Konfigurace (thresholdy, indicators)
│   └── questions-db.json   # Databáze otázek a odpovědí (~80 otázek)
└── README.md               # Tato dokumentace
```

## Vývoj a ladění

## 🐛 Vývoj a ladění

### Console log formát:
```
🔍 Detekována klávesa I - spouštím analýzu otázky
Hledám otázku pod kurzorem...
Otázka: <text otázky>
Normalizovaná: <text bez diakritiky>

=== Hledám nejlepší shodu v databázi ===
Porovnávám s otázkou: <db otázka> → 45%
Porovnávám s otázkou: <db otázka> → 89%
✅ Nejlepší shoda: 89% (práh: 70%)

DEBUG: IP adresy v odpovědi 1: [[10,0,0,0], [255,0,0,0]]
DEBUG: IP adresy v odpovědi 2: [[10,0,0,0], [255,0,0,0]]
DEBUG: Všechny IP adresy se shodují ✓
DEBUG: Ostatní čísla: [95, 1] vs [95, 1] ✓

Zvýrazněná odpověď: <text>
Grid buňka zvýrazněna
```

### Řešení problémů:

**❌ Špatná odpověď se zvýrazní:**
- Otevřete console (F12) a zkontrolujte percentuální shody
- Může existovat podobnější otázka v databázi
- Zvyšte `questionSimilarityThreshold` klávesou **P**

**❌ IP adresy nefungují:**
- Podporovány: `X.X.X.X` nebo `X.X.X` (automaticky `→ X.X.X.0`)
- Console ukáže: `DEBUG: IP adresy v odpovědi: [[10,0,0,0]]`
- Musí být v obou odpovědích na stejných pozicích

**❌ Odpověď se nenajde:**
- Snižte `similarityThreshold` klávesou **P** (aktuálně 60%)
- Zkontrolujte, že čísla jsou ve stejném pořadí
- Diakritika se automaticky normalizuje

### Úprava kódu:
1. Upravte soubory v `chrome-extension/`
2. Přejděte na `chrome://extensions/`
3. Klikněte na **⟳ Obnovit** (Reload) u rozšíření
4. Obnovte stránku Google Forms (F5)
