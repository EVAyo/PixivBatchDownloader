import { EVT } from '../EVT'
import { lang } from '../Language'
import { states } from '../store/States'
import { toast } from '../Toast'
import { Utils } from '../utils/Utils'
import { settings, setSetting } from './Settings'

/** 管理置顶的选项 */
class PinOptions {
  public init(allOption: NodeListOf<HTMLElement>) {
    // 不在 pixivision 上启用
    if (!Utils.isPixiv()) {
      return
    }

    this.allOption = allOption
    this.bindEvents()
  }

  private allOption!: NodeListOf<HTMLElement>
  private pinnedClassName = 'pinned'

  private bindEvents() {
    window.addEventListener(EVT.list.settingInitialized, () => {
      this.bindLongPress()
      this.syncPinnedClass()
    })

    window.addEventListener(EVT.list.settingChange, (ev: CustomEventInit) => {
      if (!states.settingInitialized) {
        return
      }
      const data = ev.detail.data as any
      if (data.name === 'pinnedOptions') {
        this.syncPinnedClass()
      }
    })
  }

  private bindLongPress() {
    for (const option of this.allOption) {
      const no = option.dataset.no
      if (!no || option.dataset.pinBound === 'true') {
        continue
      }

      option.dataset.pinBound = 'true'
      Utils.longPress(option, () => {
        this.togglePinOption(Number.parseInt(no))
      })
    }
  }

  private togglePinOption(noNum: number) {
    if (settings.pinnedOptions.includes(noNum)) {
      settings.pinnedOptions = settings.pinnedOptions.filter(
        (no) => no !== noNum
      )
      toast.warning(lang.transl('_取消置顶'))
    } else {
      settings.pinnedOptions.push(noNum)
      toast.success(lang.transl('_已置顶'))
    }

    setSetting('pinnedOptions', settings.pinnedOptions)
  }

  private syncPinnedClass() {
    for (const option of this.allOption) {
      const no = option.dataset.no
      if (!no) {
        continue
      }

      option.classList[
        settings.pinnedOptions.includes(Number.parseInt(no)) ? 'add' : 'remove'
      ](this.pinnedClassName)
    }
  }
}

const pinOption = new PinOptions()
export { pinOption }
