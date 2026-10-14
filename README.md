# Pitcher · Ray Yani

Site do meu personagem de **Mago: O Despertar (2ª edição)**: Ray Yani, o Pitcher.
Atleta universitário Obrimos do Conselho Livre que quebra as leis da física.

A página traz a história de origem em primeiro lugar e uma ficha compacta para consulta no final.

## Rodar

É um site estático. Basta abrir o `index.html` no navegador, ou servir a pasta:

```
npx serve .
```

## Segredos

Com a página aberta, digite no teclado:

- `force` — o vórtice do hero toma a tela e ganha potência, com raios entre as partículas. **FORÇAS ●●●**
- `space` — o olho do vórtice vira um buraco que engole tudo. **ESPAÇO ●●●**

O cursor é uma bola de beisebol em 3D com um giroscópio de partículas ao redor, que acelera quando o mouse se move rápido.

## Estrutura

```
index.html      conteúdo: hero, história, ficha
css/style.css   tema (gaiola de rebatidas à noite) e efeitos
js/main.js      pontos da ficha e o vórtice do Nimbus
js/effects.js   giroscópio do cursor e os gatilhos force / space
```

Fontes via Google Fonts: Big Shoulders Display, Barlow e IBM Plex Mono. A bola de beisebol do cursor usa Three.js (r128, via cdnjs).
