# SENAI X-Ray
Protótipo educacional para o Quest 3. A estação 01 apresenta uma impressora 3D fictícia. Os textos são demonstrativos e devem ser revisados por um instrutor.

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

## Teste de campo
1. Abra **Modo administrador** no navegador do Quest. Autorize a sessão. Confirme que vê a sala pela câmera e que a placa “Impressora 3D” acompanha a mira do controle direito.
2. Aponte para perto da máquina. Ajuste a distância com o analógico direito e confirme com o gatilho. Mova a cabeça lateralmente e confira se a placa ficou no ponto escolhido.
3. Entregue o visor ao visitante mantendo essa sessão aberta. Mire novamente na placa e aperte o gatilho. Leia o texto, alterne todas as abas, responda ao diagnóstico e percorra as três etapas.
4. Feche o painel, abra novamente e teste **Reposicionar**. Ao terminar a sessão pelo menu do Quest, repita a calibração na próxima entrada. O botão de visitante da tela inicial abre uma estação de exemplo à frente do usuário.
5. Se a sala ou a mira não aparecer, confira permissões, conexão e rastreamento do controle. Volte à tela de entrada e escolha **Prévia desktop** para continuar a explicação.

## Arquitetura e escopo
- Vite, TypeScript e IWSDK 1.1.0-rc.2, com versões resolvidas no lockfile. O script de desenvolvimento inicia o Vite com o plugin IWSDK. O lançador gerenciado original falhou ao identificar o processo no Windows deste ambiente.
- A página HTML detecta suporte a `immersive-ar`. O código imersivo é carregado sob demanda. A cena do IWSDK contém duas instâncias de UIKitML com interação pelo raio do controle.
- `src/xr.ts` mantém a posição da estação em memória e controla o painel. O ponto acompanha a direção de mira do controle direito durante o posicionamento. Cada nova sessão começa com nova calibração. Não há reconhecimento, hit-test obrigatório ou âncoras persistentes.
- Edite o conteúdo em `src/equipment.ts`. Os rótulos dos botões espaciais ficam em `public/ui/detail.uikitml` e o nome da placa em `public/ui/marker.uikitml`. Gere novamente o build para distribuir alterações. A fonte padrão do protótipo espacial usa texto sem acentos, enquanto a prévia preserva a grafia portuguesa.
- O painel e a prévia compartilham o exemplo de diagnóstico e manutenção. Ainda não há editor de cadastros, sincronização nem garantia de funcionamento offline.

## Checklist de validação
- [x] Instalação, verificação TypeScript e build no Windows.
- [x] Edge desktop, abrir prévia, navegar entre três abas, responder, avançar, voltar e fechar.
- [ ] Quest físico, HTTPS no Wi-Fi do evento, permissões e passthrough.
- [ ] Quest físico, fixar placa, virar a cabeça, selecionar, ler, fechar e reposicionar.
- [ ] Quest físico, fim e reinício de sessão, perda de rastreamento e troca de visitante.
- [ ] P1 após P0 em campo, editor de cadastro e segunda estação.

