import { World, createSystem, UIKitMLAsset, InputComponent, RayInteractable, Vector3 } from '@iwsdk/core';
import { Text } from '@pmndrs/uikit';
import options from 'virtual:iwsdk-project';
import { stationText, type Equipment } from './equipment';

function label(asset: UIKitMLAsset, id: string, value: string) {
  const text = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  asset.requireElementById(id).traverse(el => { if (el instanceof Text) el.setProperties({text}); });
}

export async function setup(catalog: Equipment[]) {
  const world = await World.create(document.querySelector<HTMLDivElement>('#scene-container')!, options);
  const panel = world.requireSceneObject<UIKitMLAsset>('detail');
  panel.visible = false;
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
    label(marker, 'inspect', machine.name);
    markers.push(marker);
  }
  let operator = false;
  class Station extends createSystem({}) {
    private selected = 0;
    private placing = -1;
    private sequential = false;
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
      markers.forEach((marker,index) => listen(marker, 'inspect', () => {
        if (!world.session || this.placing !== -1 || !marker.visible || performance.now() < this.openAfter) return;
        this.selected = index;
        this.tab = this.step = 0;
        this.feedback = '';
        panel.position.copy(this.player.head.localToWorld(this.point.set(0,0,-1.25)));
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
          for (const marker of markers) marker.visible = true;
          if (i===5 && operator) { this.placing = this.selected; this.sequential = false; }
        }
        this.renderPanel();
      });
    }
    private renderPanel() {
      const machine = catalog[this.selected];
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
        this.sequential = operator;
        this.placing = session && operator ? 0 : -1;
        markers.forEach((marker,i) => {
          marker.visible = !!session && (!operator || i===0);
          if (session && !operator) {
            const angle = i * Math.PI * 2 / markers.length;
            const radius = Math.max(1.4,markers.length * 0.15);
            marker.position.copy(this.player.head.localToWorld(this.point.set(radius*Math.sin(angle),0,-radius*Math.cos(angle))));
          }
        });
      }
      if (!session) return;
      this.player.head.getWorldPosition(this.head);
      if (this.placing >= 0) {
        const pad = this.input.xr.gamepads.right;
        const axes = pad?.getAxesValues(InputComponent.Thumbstick);
        this.distance = Math.max(0.55,Math.min(2.4,this.distance-(axes?.y ?? 0)*delta));
        const marker = markers[this.placing];
        marker.position.copy(this.player.raySpaces.right.localToWorld(this.point.set(0,0,-this.distance)));
        if (pad?.getButtonDown(InputComponent.Trigger)) {
          this.openAfter = performance.now()+450;
          const next = this.placing+1;
          this.placing = this.sequential && next<markers.length ? next : -1;
          if (this.placing >= 0) markers[this.placing].visible = true;
        }
      }
      for (const marker of markers) if (marker.visible) marker.lookAt(this.head);
      if (panel.visible) panel.lookAt(this.head);
    }
  }
  world.registerSystem(Station);
  return (admin: boolean) => { operator = admin; world.launchXR(); };
}
