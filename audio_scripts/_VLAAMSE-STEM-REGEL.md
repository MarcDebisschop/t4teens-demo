# VERPLICHTE REGEL — Vlaamse stem voor alle T4Teens-audio

## Stem
Alle audiofragmenten worden ingesproken met de TTS-stem **sulafat**.

## KRITIEK: elk script MOET beginnen met de Vlaamse instructie-header

De stemnaam "sulafat" alleen volstaat NIET. Zonder de onderstaande
instructie-regel valt de uitspraak terug op een **Hollands** accent.
Het Vlaamse accent komt uit deze uitspraak-instructie, niet uit de stemnaam.

Elk `.txt`-script in deze map begint daarom verplicht met exact deze regel,
gevolgd door een lege regel en daarna pas de voor-te-lezen tekst:

```
Lees onderstaande voor in vlot Belgisch-Nederlands met een zachte Vlaamse tongval (Oost-Vlaanderen): zachte g, geen scherpe Hollandse klanken, geen Randstad-intonatie. Klink warm, kalm en uitnodigend tegen een tiener.

<voor-te-lezen tekst hier>
```

## Genereren
```
asi-text-to-speech '{"file_path":"audio_scripts/<naam>.txt","voice":"sulafat"}'
```

## Altijd valideren na generatie
TTS produceert soms afwijkende/corrupte opnames (te lang, vreemde pauzes).
Controleer na elke generatie de duur met `ffprobe` en het spreektempo
(gezond NL-tempo ligt rond 130-200 woorden/minuut, gerekend op de
voor-te-lezen tekst ZONDER de header). Wijkt het sterk af, genereer opnieuw.

## Geschiedenis
- 16 juni 2026: oorspronkelijke Vlaamse opnames met header — goedgekeurd door Marc.
- 17 juni 2026: bij het herinspreken (fix energie-woord + afgekapte audio) was de
  header per ongeluk weggelaten -> Hollands accent. Hersteld: header weer toegevoegd
  aan alle 32 betrokken scripts, alles opnieuw ingesproken met sulafat.
