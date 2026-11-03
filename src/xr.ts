import { World, createSystem, UIKitMLAsset, InputComponent, Vector3 } from '@iwsdk/core';
import { Text } from '@pmndrs/uikit';
import options from 'virtual:iwsdk-project';
import { printer } from './equipment';

let operator = false;
class Station extends createSystem({}) {
  private marker!: UIKitMLAsset;
  private panel!: UIKitMLAsset;
  private placing = false;
  private active = false;
  private tab = 0;
  private step = 0;
  private feedback = '';
  private distance = 1.1;
  private head = new Vector3();
  private point = new Vector3();

  init() {
    this.marker = this.world.requireSceneObject<UIKitMLAsset>('marker');
    this.panel = this.world.requireSceneObject<UIKitMLAsset>('detail');
    this.marker.visible = this.panel.visible = false;
    this.marker.requireElementById('inspect').addEventListener('click', () => {
      if (this.placing || !this.active || performance.now() < this.openAfter) return;
      this.player.head.localToWorld(this.point.set(0, 0, -1.25));
      this.panel.position.copy(this.point);
      this.marker.visible = false;
      this.panel.visible = true;
      this.tab = this.step = 0;
      this.feedback = '';
      this.renderPanel();
    });
    for (let i = 0; i < 3; i++) this.panel.requireElementById('tab'+i).addEventListener('click', () => {
      this.tab = i;
      this.renderPanel();
    });
    for (let i = 0; i < 6; i++) this.panel.requireElementById('action'+i).addEventListener('click', () => {
      if (i < 2) this.feedback = printer.feedback[i];
      if (i === 2 || i === 3) this.step = Math.max(0,Math.min(printer.steps.length-1,this.step + (i === 3 ? 1 : -1)));
      if (i >= 4) {
        this.panel.visible = false;
        this.marker.visible = true;
        this.placing = i === 5 && operator;
      }
      this.renderPanel();
    });
  }
  private renderPanel() {
    const label = [printer.description, this.feedback || printer.scenario, (this.step+1) + '/3 · ' + printer.steps[this.step]][this.tab];
    this.panel.requireElementById('copy').traverse(el => { if (el instanceof Text) el.setProperties({text: label.normalize('NFD').replace(/[\u0300-\u036f]/g, '')}); });
    const show = [this.tab === 1,this.tab === 1,this.tab === 2 && this.step > 0,this.tab === 2 && this.step < printer.steps.length-1,true,operator];
    show.forEach((visible,i) => this.panel.requireElementById('action'+i).setProperties({display:visible?'flex':'none'}));
  }
  private openAfter = 0;
  update(delta: number) {
    if (!this.world.session) {
      this.active = this.panel.visible = this.marker.visible = false;
      return;
    }
    if (!this.active) {
      this.active = this.marker.visible = true;
      this.placing = operator;
      this.marker.position.copy(this.player.head.localToWorld(this.point.set(0,0,-1.3)));
    }
    this.player.head.getWorldPosition(this.head);
    if (this.placing) {
      const pad = this.input.xr.gamepads.right;
      const axes = pad?.getAxesValues(InputComponent.Thumbstick);
      this.distance = Math.max(0.55,Math.min(2.4,this.distance - (axes?.y ?? 0)*delta));
      this.marker.position.copy(this.player.raySpaces.right.localToWorld(this.point.set(0,0,-this.distance)));
      if (pad?.getButtonDown(InputComponent.Trigger)) {
        this.placing = false;
        this.openAfter = performance.now()+450;
      }
    }
    this.marker.lookAt(this.head);
    this.panel.lookAt(this.head);
  }
}
export async function setup() {
  const world = await World.create(document.querySelector<HTMLDivElement>('#scene-container')!, options);
  world.registerSystem(Station);
  return (admin: boolean) => { operator = admin; world.launchXR(); };
}


