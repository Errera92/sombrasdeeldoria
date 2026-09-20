# Atualização visual de Sombras de Eldoria

## Objetivo
Substituir gradualmente os desenhos procedurais por imagens de fantasia sombria, sem alterar lógica, dados, pontuação, integrações ou ciclo de vida.

## Fase 1 — Assets, carregamento e cenários
- Gerar e otimizar três cenários, três torres, três inimigos principais e a base em WebP, respeitando transparência e limites de peso.
- Criar o catálogo `ASSETS` no HTML e carregar as texturas em `BootScene.preload()` com barra de progresso.
- Fazer falhas individuais de asset não bloquearem o início do jogo.
- Exibir o cenário correspondente no mapa quando disponível; preservar integralmente o fundo procedural como fallback.
- Refinar o caminho com sombra e bordas mais suaves, sem mudar sua geometria.
- Usar os cenários nos cards de estágio com máscara arredondada e manter o traçado do caminho por cima.
- Validar carregamento, seleção de estágio, troca de fase e fallback antes de parar para aprovação.

## Fase 2 — Torres, base e slots
- Trocar somente os filhos visuais dos containers de torres por sprites.
- Manter sombra, aura, flash, interação, alcance, grupos e referências atuais.
- Usar a imagem da base mantendo seu brilho pulsante.
- Aplicar textura opcional aos slots com fallback atual.
- Validar construção, troca, reembolso, mudança de fase e reinício antes de pedir aprovação.

## Fase 3 — Inimigos
- Substituir os corpos dos inimigos suportados por sprites dentro dos containers existentes.
- Preservar `body`, barra de vida, grupos, movimento e estatísticas.
- Animar somente o sprite filho; remover qualquer tween restante no container do inimigo.
- Virar o sprite pelo sentido horizontal e adaptar efeitos de dano/gelo para tint.
- Manter inimigos sem asset no visual procedural atual.
- Validar ondas, dano, congelamento, morte, chegada à base e troca de fase antes de pedir aprovação.

## Fase 4 — Polimento
- Refinar projéteis sem trocar sua lógica ou camada de desenho.
- Adicionar no máximo 20 elementos ambientais leves e garantir limpeza correta.
- Harmonizar apenas cores e bordas da interface, sem alterar layout ou ações.
- Fazer verificação final em desktop e celular horizontal.

## Restrições preservadas
- Nenhuma alteração em bridge React, backend, SQL, multiplicadores, stats, estágios, ondas, fórmulas, itens ou pontuação.
- Resolução lógica 1280×720 e `Scale.FIT` mantidos.
- Fallback procedural disponível para toda imagem ausente.
- Cada fase será concluída e apresentada separadamente para aprovação.
