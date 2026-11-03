import { AssetType, defineAssets } from '@iwsdk/core';
const panel = (name: string) => ({ name, type: AssetType.UIKitML, url: import.meta.env.BASE_URL + 'ui/' + name + '.uikitml' });
export default defineAssets({ marker: panel('marker'), detail: panel('detail') });
