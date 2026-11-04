import { World, createSystem, UIKitMLAsset, InputComponent, RayInteractable, Vector3 } from '@iwsdk/core';
import { Text } from '@pmndrs/uikit';
import options from 'virtual:iwsdk-project';
import { fieldsFor, kindLabel, proceduresFor, type Equipment } from './equipment';

const fontFamilies = { Barlow: { 600: import.meta.env.BASE_URL + 'fonts/barlow-pt.json' } };
function styleText(asset: UIKitMLAsset) {
  asset.traverse(el => {
    if (el instanceof Text) el.setProperties({fontFamily: 'Barlow', fontFamilies, fontWeight: 600});
  });
}

function label(asset: UIKitMLAsset, id: string, value: string) {
  asset.requireElementById(id).traverse(el => { if (el instanceof Text) el.setProperties({text: value.normalize('NFC')}); });
}

export async function setup(catalog: Equipment[], onPlacement: (ids: ReadonlySet<string>) => void, onExit: () => void) {
  const world = await World.create(document.querySelector<HTMLDivElement>('#scene-container')!, options);
  const panel = world.requireSceneObject<UIKitMLAsset>('detail');
  panel.visible = false;
  const menu = await world.assets.instantiate<UIKitMLAsset>('placement');
  panel.scale.multiplyScalar(0.80);
  styleText(panel);
  styleText(menu);
  menu.scale.copy(panel.scale);
  world.createTransformEntity(menu).addComponent(RayInteractable);
  menu.visible = false;
  const markers: UIKitMLAsset[] = [];
  for (const machine of catalog) {
    const marker = markers.length === 0
      ? world.requireSceneObject<UIKitMLAsset>('marker')
      : await world.assets.instantiate<UIKitMLAsset>('marker');
    if (markers.length) {
      marker.scale.copy(markers[0].scale);
      world.createTransformEntity(marker).addComponent(RayInteractable);
    }
    marker.visible = false;
    styleText(marker);
    label(marker, 'marker-name', machine.name);
    markers.push(marker);
  }
  let operator = false;
  class Station extends createSystem({}) {
    private selected = 0;
    private route = -1;
    private compact = markers.map(()=>false);
    private setCompact(index: number, compact: boolean) {
      if (this.compact[index] === compact) return;
      this.compact[index] = compact;
      markers[index].requireElementById('caption').setProperties({display:compact?'none':'flex'});
    }
    private hovering = markers.map(()=>new Set<number>());
    private near = markers.map(()=>true);
    private placing = -1;
    private placed = new Set<string>();
    private page = 0;
    private previousPosition = new Vector3();
    private placementReady = false;
    private scanning = false;
    private session: XRSession | null = null;
    private tab = 0;
    private step = 0;
    private feedback = '';
    private distance = 1.1;
    private head = new Vector3();
    private point = new Vector3();
    private openAfter = 0;

    init() {
      const listen = (asset: UIKitMLAsset, id: string, fn: () => void) => {
        const el = asset.requireElementById(id);
        el.addEventListener('click', fn);
        this.cleanupFuncs.push(() => el.removeEventListener('click', fn));
      };
      listen(menu,'exit',()=>{ if (menu.visible) world.exitXR(); });
      listen(panel,'exit',()=>{ if (panel.visible) world.exitXR(); });
      listen(menu,'scan',async ()=>{
        const session = world.session;
        if (!menu.visible || this.placed.size || this.scanning || !session?.initiateRoomCapture) return;
        this.scanning = true;
        try {
          await session.initiateRoomCapture();
        } catch {
          if (world.session === session) label(menu,'scan','Tentar novamente ou usar Espaço físico no Quest');
        } finally { this.scanning = false; }
      });
      for (let slot = 0; slot < 3; slot++) listen(menu,'slot'+slot, () => {
        const index = this.page*3+slot;
        if (menu.visible && index < catalog.length && performance.now() >= this.openAfter) this.beginPlacement(index);
      });
      listen(menu,'prev',()=>{ if (menu.visible && this.page>0) { this.page--; this.renderMenu(); } });
      listen(menu,'next',()=>{ if (menu.visible && (this.page+1)*3<catalog.length) { this.page++; this.renderMenu(); } });
      listen(menu,'visit',()=>{ if (menu.visible && this.placed.size) { menu.visible = false; this.showMarkers(); } });
      markers.forEach((marker,index) => {
        const button = marker.requireElementById('inspect');
        const pointers = this.hovering[index];
        const enter = (event: {pointerId:number}) => { pointers.add(event.pointerId); };
        const leave = (event: {pointerId:number}) => { pointers.delete(event.pointerId); };
        button.addEventListener('pointerenter',enter);
        button.addEventListener('pointerleave',leave);
        this.cleanupFuncs.push(()=>{
          button.removeEventListener('pointerenter',enter);
          button.removeEventListener('pointerleave',leave);
        });
      });
      markers.forEach((marker,index) => listen(marker, 'inspect', () => {
        if (!world.session || this.placing !== -1 || !marker.visible || performance.now() < this.openAfter) return;
        this.selected = index;
        this.tab = this.step = 0; this.route = -1;
        this.feedback = '';
        panel.position.copy(marker.position);
        panel.position.y += 0.22;
        for (const pointers of this.hovering) pointers.clear();
        for (const item of markers) item.visible = false;
        panel.visible = true;
        this.renderPanel();
      }));
      for (let i=0;i<3;i++) listen(panel, 'tab'+i, () => { if (catalog[this.selected].kind==='part' && i===2) return; this.tab = i; this.step = 0; this.route = -1; this.renderPanel(); });
      for (let i=0;i<3;i++) listen(panel,'route'+i,()=>{
        this.route = this.step*3+i; this.step = 0; this.renderPanel();
      });
      listen(panel,'routes',()=>{ this.route = -1; this.step = 0; this.renderPanel(); });
      for (let i=0;i<6;i++) listen(panel, 'action'+i, () => {
        const machine = catalog[this.selected];
        if (i<2) this.feedback = machine.quiz?.feedback[i] ?? '';
        if (i===2 || i===3) this.step = Math.max(0,this.step+(i===3?1:-1));
        if (i>=4) {
          panel.visible = false;
          this.showMarkers();
          if (i===5 && operator) this.beginPlacement(this.selected);
        }
        this.renderPanel();
      });
    }
    private showMarkers() {
      markers.forEach((marker,i) => { marker.visible = !operator || this.placed.has(catalog[i].id); });
    }
    private beginPlacement(index: number) {
      this.setCompact(index,false);
      this.placing = index;
      this.previousPosition.copy(markers[index].position);
      this.placementReady = false;
      menu.visible = panel.visible = false;
      markers.forEach((m,i)=>{ m.visible = i===index; });
      label(markers[index],'marker-action','Gatilho para fixar   /   B para cancelar');
    }
    private openMenu() {
      if (this.placing >= 0) {
        const i = this.placing;
        markers[i].position.copy(this.previousPosition);
        label(markers[i],'marker-action','Visualizar');
        this.placing = -1;
      }
      for (const marker of markers) marker.visible = false;
      panel.visible = false;
      menu.position.copy(this.player.head.localToWorld(this.point.set(0,0,-1.25)));
      this.player.head.getWorldPosition(this.head);
      menu.lookAt(this.head);
      menu.visible = true;
      this.renderMenu();
    }
    private renderMenu() {
      const pages = Math.ceil(catalog.length/3);
      const session = world.session;
      const canScan = !this.placed.size && typeof session?.initiateRoomCapture === 'function'
        && (!session.enabledFeatures || session.enabledFeatures.includes('plane-detection'));
      menu.requireElementById('scan').setProperties({display:canScan?'flex':'none'});
      label(menu,'summary',this.placed.size+' de '+catalog.length+' posicionadas  /  Pág. '+(this.page+1)+' de '+pages);
      for (let slot=0;slot<3;slot++) {
        const item = catalog[this.page*3+slot];
        menu.requireElementById('slot'+slot).setProperties({display:item?'flex':'none'});
        if (item) label(menu,'slot'+slot,(this.placed.has(item.id)?'Posicionada':'A posicionar')+'  /  '+kindLabel(item)+' · '+item.name);
      }
      menu.requireElementById('prev').setProperties({display:this.page>0?'flex':'none'});
      menu.requireElementById('next').setProperties({display:this.page+1<pages?'flex':'none'});
      menu.requireElementById('visit').setProperties({display:this.placed.size?'flex':'none'});
    }
    private renderPanel() {
      const machine = catalog[this.selected];
      for (let i=0;i<3;i++) {
        const tab = panel.requireElementById('tab'+i);
        const active = i===this.tab;
        tab.setProperties({display:machine.kind==='part' && i===2?'none':'flex',
          borderColor:active?'#ffe36a':'#93accc',backgroundColor:active?'#403619':'#182638'});
        tab.traverse(el=>{ if (el instanceof Text) el.setProperties({color:active?'#fff39b':'#ffffff'}); });
      }
      const routes = proceduresFor(machine);
      const selected = this.tab===2 ? routes[this.route] : undefined;
      const fields = this.tab<2 ? fieldsFor(machine,this.tab) : [];
      const list = this.tab===2 && !selected;
      const count = selected ? selected.steps.length : Math.ceil((list?routes.length:fields.length)/3);
      this.step = Math.max(0,Math.min(this.step,count-1));
      label(panel,'machine',machine.name);
      label(panel,'chapter',kindLabel(machine).toUpperCase()+'   /   0'+(this.tab+1));
      label(panel,'page-label',count>1 ? (selected?'ETAPA  ':'PÁGINA  ')+(this.step+1)+' / '+count : '');
      panel.requireElementById('figure').setProperties({display:machine.photo?'flex':'none'});
      label(panel,'title',selected?.title ?? ['Informações','Diagnóstico simulado','Manutenções'][this.tab]);
      panel.requireElementById('photo').setProperties({src:machine.photo,display:machine.photo?'flex':'none'});
      for (let i=0;i<3;i++) {
        const field = fields[this.step*3+i];
        panel.requireElementById('field'+i).setProperties({display:field?'flex':'none'});
        if (field) { label(panel,'key'+i,field.key); label(panel,'val'+i,field.value); }
        const route = list && routes[this.step*3+i];
        panel.requireElementById('route'+i).setProperties({display:route?'flex':'none'});
        if (route) label(panel,'route'+i,route.title);
      }
      const question = this.tab===1 && machine.kind!=='part' && machine.quiz;
      const copy = selected ? 'Etapa '+(this.step+1)+' de '+count+'\n'+selected.steps[this.step]
        : question ? this.feedback || question.question : !count ? 'Nenhum conteúdo cadastrado nesta seção.' : '';
      panel.requireElementById('copy').setProperties({display:copy?'flex':'none'});
      if (copy) label(panel,'copy',copy);
      panel.requireElementById('routes').setProperties({display:selected?'flex':'none'});
      const show = [!!question,!!question,this.step>0,this.step+1<count,true,operator];
      show.forEach((visible,i) => panel.requireElementById('action'+i).setProperties({display:visible?'flex':'none'}));
      machine.quiz?.choices.forEach((choice,i) => label(panel,'action'+i,choice));
    }
    update(delta: number) {
      const session = world.session ?? null;
      if (this.session !== session) {
        this.session = session;
        panel.visible = false;
        menu.visible = false;
        this.page = 0;
        this.placed.clear();
        onPlacement(this.placed);
        if (session) session.addEventListener('end', () => {
          this.placed.clear();
          onPlacement(this.placed);
          onExit();
        }, {once:true});
        this.placing = -1;
        markers.forEach((marker,i) => {
          this.hovering[i].clear();
          this.near[i] = true;
          marker.visible = !!session && !operator;
          if (session && !operator) {
            const angle = i * Math.PI * 2 / markers.length;
            const radius = Math.max(1.4,markers.length * 0.15);
            marker.position.copy(this.player.head.localToWorld(this.point.set(radius*Math.sin(angle),0,-radius*Math.cos(angle))));
          }
        });
        if (session && operator) this.openMenu();
      }
      if (!session) return;
      if (this.input.xr.gamepads.right?.getButtonDown(InputComponent.B_Button)) {
        if (operator) this.openMenu();
        else world.exitXR();
        return;
      }
      this.player.head.getWorldPosition(this.head);
      if (this.placing >= 0) {
        const pad = this.input.xr.gamepads.right;
        const axes = pad?.getAxesValues(InputComponent.Thumbstick);
        this.distance = Math.max(0.55,Math.min(2.4,this.distance-(axes?.y ?? 0)*delta));
        const marker = markers[this.placing];
        marker.position.copy(this.player.raySpaces.right.localToWorld(this.point.set(0,0,-this.distance)));
        if (pad && !pad.getButtonPressed(InputComponent.Trigger)) this.placementReady = true;
        if (this.placementReady && pad?.getButtonDown(InputComponent.Trigger)) {
          this.openAfter = performance.now()+450;
          const index = this.placing;
          this.placed.add(catalog[index].id);
          onPlacement(this.placed);
          this.placing = -1;
          label(marker,'marker-action','Visualizar');
          this.openMenu();
        }
      }
      for (let i=0;i<markers.length;i++) {
        const marker = markers[i];
        if (!marker.visible) continue;
        if (this.placing < 0) {
          const distance = marker.position.distanceToSquared(this.head);
          this.near[i] = distance <= (this.near[i] ? 3**2 : 2.5**2);
          this.setCompact(i, !this.near[i] && !this.hovering[i].size);
        }
        marker.lookAt(this.head);
      }
      if (panel.visible) panel.lookAt(this.head);
    }
  }
  world.registerSystem(Station);
  return (admin: boolean) => {
    operator = admin;
    world.launchXR(admin ? {features:{planeDetection:{required:false}}} : undefined);
  };
}
