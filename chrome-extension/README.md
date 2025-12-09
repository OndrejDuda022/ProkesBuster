# Google Forms Auto-fill Extension

Chrome rozšíření pro automatické vyplňování Google formulářů s inteligentním porovnáváním otázek a odpovědí.

## Funkce

- **Automatická detekce otázek**: Při stisku klávesy I rozšíření nasnímá aktuální otázku
- **Inteligentní porovnání**: Porovnává text otázky s databází s nastavitelným prahem podobnosti
- **Normalizace textu**: Odstraňuje diakritiku a interpunkci pro lepší rozpoznávání
- **Přesná čísla**: Čísla v odpovědích musí být přesně stejná
- **Podobnost slov**: Slova se porovnávají s tolerancí
- **Dočasné ztučnění**: Nejlepší odpověď se ztuční na 3 sekundy
- **Podpora více typů otázek**:
  - Radio buttons (jedna správná odpověď)
  - Checkboxes (více správných odpovědí)
  - Rozbalovací nabídka (dropdown)
  - Mřížkové otázky (grid) s více řádky a sloupci
- **No-match indikátor**: Malý červený vykřičník uprostřed dole při nenalezení shody
- **Konfigurovatelný práh**: Nastavitelné procento podobnosti v config.json

## Instalace

1. Otevřete Chrome a přejděte na `chrome://extensions/`
2. Zapněte "Režim pro vývojáře" (Developer mode) v pravém horním rohu
3. Klikněte na "Načíst rozbalené rozšíření" (Load unpacked)
4. Vyberte složku `chrome-extension`

## Použití

1. Otevřete Google formulář (https://docs.google.com/forms/)
2. Najeďte myší na otázku
3. Stiskněte **klávesu I** pro analýzu a ztučnění správné odpovědi
4. Stiskněte **klávesu O** pro okamžité zrušení všech ztučnění

## Konfigurace

Rozšíření používá konfigurační soubor `config.json` pro nastavení chování:

```json
{
  "similarityThreshold": 90,
  "showNoMatchIndicator": true
}
```

- **similarityThreshold**: Minimální procentuální shoda pro považování otázky za match (výchozí: 80)
- **showNoMatchIndicator**: Zobrazit červený vykřičník, když není nalezena shoda (výchozí: true)

## Databáze otázek

Otázky a správné odpovědi jsou uloženy v souboru `questions-db.json`. 

### Formát:

**Jedna správná odpověď:**
```json
{
  "question": "Text otázky",
  "correctAnswer": "Správná odpověď"
}
```

**Více správných odpovědí (pro checkboxy):**
```json
{
  "question": "Text otázky s více odpověďmi",
  "correctAnswer": ["Odpověď 1", "Odpověď 2", "Odpověď 3"]
}
```

**Mřížkové otázky (grid):**
```json
{
  "question": "Ohodnoťte následující položky",
  "correctAnswer": {
    "Řádek 1": "Sloupec A",
    "Řádek 2": "Sloupec B",
    "Řádek 3": "Sloupec C"
  }
}
```

### Přidání nových otázek:

Otevřete `questions-db.json` a přidejte nový objekt do pole s otázkou a správnou odpovědí (nebo více odpověďmi v poli).

## Jak to funguje

1. **Načtení databáze**: Při načtení stránky se načte databáze otázek
2. **Detekce otázky**: Po stisku I se najde nejbližší otázka
3. **Porovnání textu**: Text otázky se porovná s databází pomocí Levenshteinovy vzdálenosti
4. **Práh shody**: Pokud je shoda alespoň 80%, pokračuje se k odpovědím
4. **Porovnání odpovědí**: 
   - Čísla musí být **přesně stejná**
   - Slova se porovnávají s tolerancí
5. **Dočasné ztučnění**: Nejlepší odpověď se ztuční na 3 sekundy

## Technické detaily

- **Manifest V3**: Používá nejnovější verzi Chrome rozšíření
- **Content Script**: Běží přímo na stránce Google Forms
- **Levenshteinova vzdálenost**: Pro výpočet podobnosti textů
- **Regex extrakce**: Pro identifikaci čísel v textu

## Struktura souborů

\`\`\`
chrome-extension/
├── manifest.json          # Konfigurace rozšíření
├── content.js            # Hlavní logika rozšíření
├── styles.css            # Styly pro zvýraznění
├── questions-db.json     # Databáze otázek a odpovědí
└── README.md            # Tato dokumentace
\`\`\`

## Poznámky

- Rozšíření funguje pouze na stránkách `https://docs.google.com/forms/*`
- Pro produkční použití je potřeba přidat ikony (icon16.png, icon48.png, icon128.png)
- Databázi otázek můžete rozšířit podle svých potřeb
- Práh podobnosti lze upravit v `config.json` (výchozí: 80%)
- Červený vykřičník se zobrazí na 3 sekundy při nenalezení shody (uprostřed dole)
- Ztučnění odpovědi automaticky zmizí po 3 sekundách
- Klávesy I a O nefungují ve vstupních polích (input/textarea)
