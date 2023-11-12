import sceneAttrs from '../assets/game/scene_attrs.json'
import { Digit, FcNodeAttrs, FcSceneAttrs, RouteDayName, RouteName, SceneName, UcLetter } from '../types'

export const APP_VERSION = import.meta.env.VITE_VERSION

export const ASSETS_PATH = import.meta.env.DEV ? "/static/" : `${import.meta.env.BASE_URL}static/`
export const SCENE_ATTRS : {
  //days: string[],
  //routes: Record<RouteName, Record<RouteDayName, string>>,
  'fc-nodes'?: Record<string, FcNodeAttrs>,
  scenes: Record<SceneName, ({
    title: string,
  } | {
      r: (RouteName | { flg: UcLetter|Digit, "0": RouteName, "1": RouteName }),
      d: RouteDayName
      s?: (string | { flg: UcLetter|Digit, "0": string, "1": string }),
  }) & {
    h?: true
    osiete?: true
    fc?: FcSceneAttrs
  }>
} = JSON.parse(JSON.stringify(sceneAttrs))

export enum TEXT_SPEED {
  instant = 0,
  fast = 1,
  normal = 20,
  slow = 50,
}

export const SAVE_EXT = "thweb"
export const HISTORY_MAX_PAGES = 20