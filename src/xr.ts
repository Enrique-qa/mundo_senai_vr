import { World, createSystem, UIKitMLAsset, InputComponent, RayInteractable, Vector3 } from '@iwsdk/core';
import { Text } from '@pmndrs/uikit';
import options from 'virtual:iwsdk-project';
import { stationText, type Equipment } from './equipment';

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
    label(marker, 'inspect', machine.name + '  /  Abrir informações');
    markers.push(marker);
  }
  let operator = false;
  class Station extends createSystem({}) {
    private selected = 0;
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
      markers.forEach((marker,index) => listen(marker, 'inspect', () => {
        if (!world.session || this.placing !== -1 || !marker.visible || performance.now() < this.openAfter) return;
        this.selected = index;
        this.tab = this.step = 0;
        this.feedback = '';
        panel.position.copy(marker.position);
        panel.position.y += 0.35;
        for (const item of markers) item.visible = false;
        panel.visible = true;
        this.renderPanel();
      }));
      for (let i=0;i<3;i++) listen(panel, 'tab'+i, () => { this.tab = i; this.renderPanel(); });
      for (let i=0;i<6;i++) listen(panel, 'action'+i, () => {
        const machine = catalog[this.selected];
        if (i<2) this.feedback = machine.quiz?.feedback[i] ?? '';
        if (i===2 || i===3) this.step = Math.max(0,Math.min(machine.steps.length-1,this.step+(i===3?1:-1)));
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
      this.placing = index;
      this.previousPosition.copy(markers[index].position);
      this.placementReady = false;
      menu.visible = panel.visible = false;
      markers.forEach((m,i)=>{ m.visible = i===index; });
      label(markers[index],'inspect',catalog[index].name + '  /  Gatilho: fixar  /  B: cancelar');
    }
    private openMenu() {
      if (this.placing >= 0) {
        const i = this.placing;
        markers[i].position.copy(this.previousPosition);
        label(markers[i],'inspect',catalog[i].name + '  /  Abrir informações');
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
        if (item) label(menu,'slot'+slot,(this.placed.has(item.id)?'Posicionada':'A posicionar')+'  /  '+item.name);
      }
      menu.requireElementById('prev').setProperties({display:this.page>0?'flex':'none'});
      menu.requireElementById('next').setProperties({display:this.page+1<pages?'flex':'none'});
      menu.requireElementById('visit').setProperties({display:this.placed.size?'flex':'none'});
    }
    private renderPanel() {
      const machine = catalog[this.selected];
      for (let i=0;i<3;i++) panel.requireElementById('tab'+i).setProperties({
        borderColor: i===this.tab ? '#ffe651' : '#435060',
        backgroundColor: i===this.tab ? '#38321b' : '#1a2131'
      });
      label(panel,'title',machine.name);
      label(panel,'copy',stationText(machine,this.tab,this.step,this.feedback));
      const show = [this.tab===1 && !!machine.quiz,this.tab===1 && !!machine.quiz,this.tab===2 && this.step>0,this.tab===2 && this.step<machine.steps.length-1,true,operator];
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
          label(marker,'inspect',catalog[index].name + '  /  Abrir informações');
          this.openMenu();
        }
      }
      for (const marker of markers) if (marker.visible) marker.lookAt(this.head);
      if (panel.visible) panel.lookAt(this.head);
    }
  }
  world.registerSystem(Station);
  return (admin: boolean) => {
    operator = admin;
    world.launchXR(admin ? {features:{planeDetection:{required:false}}} : undefined);
  };
}
