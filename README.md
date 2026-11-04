# SENAI X-Ray
Protótipo educacional para o Quest 3. O catálogo começa com uma impressora 3D fictícia que pode ser editada ou excluída. Os textos são demonstrativos e devem ser revisados por um instrutor.

## Executar
Com Node 24 e npm, execute no diretório deste projeto:

```sh
npm install
npm run typecheck
npm run dev
```

Abra o endereço HTTPS mostrado por Vite. Para o headset use a URL indicada em **Network**, com o computador e o Quest no mesmo Wi-Fi. A porta padrão é 8081. Permita acesso na rede privada se o firewall solicitar. Confira no Quest se o navegador aceita o certificado local e autoriza a sessão. Se o navegador bloquear a sessão, sirva o build em uma hospedagem estática com HTTPS confiável.

```sh
npm run build
```

Publique o conteúdo de `dist/`, preservando os subdiretórios. A prévia desktop funciona em navegador comum. No localhost o servidor de desenvolvimento também pode ativar o emulador do SDK.

## Publicar no Render
No painel do Render, escolha **New → Static Site** e conecte o repositório
`Enrique-qa/mundo_senai_vr`. Selecione a branch `main` e deixe **Root Directory** em branco.
Defina **Build Command** como `npm ci --include=dev && npm run typecheck && npm run build`,
**Publish Directory** como `dist` e a variável `SKIP_INSTALL_DEPS=true`.
Clique em **Create Static Site**. Quando aparecer **Live**, abra a URL HTTPS indicada
no navegador do Quest e siga o teste abaixo.

## Área física e saída no Quest
Configure o limite em escala de sala (Roomscale) para o percurso livre entre as máquinas. No menu do administrador, **Escanear ambiente** aparece antes do primeiro posicionamento quando o navegador disponibiliza captura de sala. Se o botão estiver ausente, use **Espaço físico** nas configurações do Quest. Capturar a sala e ajustar o limite são operações distintas.

**Voltar ao navegador** encerra a sessão pelo menu de preparação ou pela ficha. Durante o posicionamento, **B** retorna ao menu. Na entrada direta de visitante, **B** encerra a sessão. As posições precisam de nova calibração na próxima entrada.

Os textos imersivos usam o atlas local Barlow SemiBold com glifos portugueses. A licença OFL acompanha a fonte em `public/fonts/`.

## Teste de campo
1. Use **Gerenciar máquinas** para cadastrar as fichas no próprio Quest. Abra **Posicionar no ambiente** no navegador do Quest. Autorize a sessão. Confirme que vê a sala pela câmera e que a placa “Impressora 3D” acompanha a mira do controle direito.
2. Selecione uma máquina na lista paginada. Confira o estado **A posicionar** ou **Posicionada** e o total preparado. Mire na marca física escolhida para essa máquina. Ajuste a distância com o analógico direito e confirme com o gatilho. Mova a cabeça lateralmente e confira se a placa ficou no ponto escolhido.
3. Selecione **Iniciar visita** para mostrar somente as máquinas já posicionadas. Entregue o visor mantendo a sessão aberta. Mire novamente na placa e aperte o gatilho. Leia o texto, alterne todas as abas, responda ao diagnóstico e percorra as três etapas.
4. O painel abre acima do marcador. Feche-o e use **B** no controle direito para reabrir a lista. Escolha uma máquina posicionada para reajustar; **B** durante o ajuste cancela e restaura o ponto anterior. Ao terminar a sessão pelo menu do Quest, repita a calibração na próxima entrada. O botão de visitante da tela inicial abre os marcadores em posições de demonstração.
5. Se a sala ou a mira não aparecer, confira permissões, conexão e rastreamento do controle. Volte à tela de entrada e escolha **Explorar em 2D** para continuar a explicação.

## Arquitetura e escopo
- Vite, TypeScript e IWSDK 1.1.0-rc.2, com versões resolvidas no lockfile. O script de desenvolvimento inicia o Vite com o plugin IWSDK. O lançador gerenciado original falhou ao identificar o processo no Windows deste ambiente.
- A página HTML detecta suporte a `immersive-ar`. O código imersivo é carregado sob demanda. A cena do IWSDK contém duas instâncias de UIKitML com interação pelo raio do controle.
- `src/xr.ts` mantém a posição da estação em memória e controla o painel. O ponto acompanha a direção de mira do controle direito durante o posicionamento. Cada nova sessão começa com nova calibração. Não há reconhecimento, hit-test obrigatório ou âncoras persistentes.
- Use **Gerenciar máquinas** para adicionar, editar e excluir fichas. Cada máquina recebe um identificador próprio e um marcador na sessão. A prévia e o painel espacial consultam o mesmo catálogo. As fichas ficam no armazenamento do navegador em que foram cadastradas; os marcadores exigem novo posicionamento em cada sessão.

## Checklist de validação
- [x] Instalação, verificação TypeScript e build no Windows.
- [x] Edge desktop, abrir prévia, navegar entre três abas, responder, avançar, voltar e fechar.
- [ ] Quest físico, HTTPS no Wi-Fi do evento, permissões e passthrough.
- [ ] Quest físico, fixar placa, virar a cabeça, selecionar, ler, fechar e reposicionar.
- [ ] Quest físico, fim e reinício de sessão, perda de rastreamento e troca de visitante.
- [ ] P1 após P0 em campo, validar o posicionamento de duas ou mais máquinas no mesmo ambiente.


## Fichas e distância de leitura
Em **Gerenciar máquinas**, inclua uma foto opcional, pares de especificação e valor, diagnóstico simulado e procedimentos com suas próprias etapas. A pergunta de diagnóstico também pode ser editada ou removida. A foto é reduzida no navegador e salva com a ficha neste dispositivo.
Na visita, a seção **Manutenções** abre a lista de procedimentos. No Quest, as especificações, leituras e listas longas são paginadas. A mais de 3 m, o marcador mostra apenas a seta. Aponte para ela ou aproxime-se a até 2,5 m para ver o nome e “Visualizar”. Clique para abrir a ficha. Em Diagnóstico, máquinas e peças exibem o status de operação cadastrado, Ativo ou Inativo. O posicionamento pelo administrador mantém a identificação visível.
