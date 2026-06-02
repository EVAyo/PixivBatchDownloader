import { EVT } from '../EVT'
import { lang } from '../Language'
import { ppdTask } from '../PPDTask'
import { states } from '../store/States'
import { toast } from '../Toast'
import { Utils } from '../utils/Utils'
import { setSetting, settings } from './Settings'
import { optionConfigs } from './OptionConfigs'

/** 所有 Wiki 项的配置。key 是分类名字，value 是该分类下的设置项和按钮的 ID 列表 */
// PS：设置项的 id 是数字，功能按钮的 id 是字符串
type WikiConfig = {
  [key in string]: (string | number)[]
}

/**Wiki 上已经实装的语言 */
type AvailableLanguages = 'zh-cn' | 'en'

/** 为每个设置和按钮创建其在 Wiki 上的 URL */
class Wiki {
  constructor() {
    this.bindEvents()
  }

  // 初始保存了所有按钮的配置，设置项的配置会在 settingInitialized 事件触发时从 optionConfigs 里追加进来
  private WikiConfig: WikiConfig = {
    'Buttons-Crawl': [
      'startCrawling',
      'stopCrawling',
      'scheduleCrawling',
      'cancelScheduledCrawling',
      'manuallySelectWork',
      'clearSelectedWork',
      'crawlSelectedWork',
      'crawlCurrentPageWork',
      'startCrawlingFromCurrentPageNew',
      'startCrawlingFromCurrentPageOld',
      'crawlRelatedWork',
      'downloadRecommendedWorks',
      'crawlSimilarImage',
      'crawlCurrentWork',
      'crawlImagesOnThisPage',
      'crawlRankingWork',
      'crawlDebutWork',
      'filterResults',
      'crawlTagList',
      'startCrawlingInFollowingPage',
      'exportFollowingListCSV',
      'exportFollowingListJSON',
      'batchFollowUser',
      'crawlById',
      'crawlIdRange',
      'importIDList',
      'crawlSeriesNovel',
      'mergeSeriesNovel',
      'clearMultiImageWork',
      'clearUgoiraWork',
      'manuallyDeleteWork',
      'exportDashboardData',
      'crawlApplicationWork',
      'crawlWinningWork',
      'findDeactivatedUsers',
    ],
    'Buttons-Download': [
      'importCrawlResults',
      'exportCrawlResultsJSON',
      'exportCrawlResultsCSV',
      'previewFileName',
      'startDownload',
      'pauseDownload',
      'stopDownload',
      'copyURLs',
    ],
    'Buttons-More': [
      'bookmarkAllWorksOnPage',
      'addTagToUnmarkedWork',
      'removeTagsFromAllWorksOnPage',
      'unBookmarkAllWorksOnPage',
      'unBookmarkAll404Works',
      'exportBookmarkList',
      'importBookmarkList',
      'clearSavedCrawlResult',
      'saveUserAvatar',
      'saveUserAvatarAsIcon',
      'saveUserCoverImage',
    ],
  }

  private bindEvents() {
    window.addEventListener(EVT.list.settingInitialized, () => {
      this.appendOptionsToConfig()
      // console.log('WikiConfig', this.WikiConfig)
      this.setOptionLink()
    })

    // 当用户修改了语言时，重设每个设置项的链接
    window.addEventListener(EVT.list.langChange, () => {
      if (states.settingInitialized) {
        this.setOptionLink()
      }
    })

    window.addEventListener(EVT.list.settingChange, (ev: CustomEventInit) => {
      if (!states.settingInitialized) {
        return
      }
      const data = ev.detail.data as any
      if (data.name === 'debugForWiki') {
        this.setOptionLink()
      }
    })

    // 切换 Wiki 网址为本地调试的网址或者线上网址
    ppdTask.register(3, 'Switch Wiki Home', () => {
      setSetting('debugForWiki', !settings.debugForWiki)
      const msg = `debugForWiki: ${settings.debugForWiki}`
      console.log(msg)
      toast.success(msg)
      this.setOptionLink()
    })
  }

  /** 从 optionConfig 里把所有二级分类的配置追加到 WikiConfig 里*/
  private appendOptionsToConfig() {
    for (const [categoryLevel1, subCategories] of Object.entries(
      optionConfigs.optionsByCategory
    )) {
      for (const [categoryLevel2, config] of Object.entries(subCategories)) {
        const groupName = `${categoryLevel1}-${categoryLevel2}`
        if (!this.WikiConfig[groupName]) {
          this.WikiConfig[groupName] = config.ids
        }
      }
    }
  }

  // 由于 Wiki 现在只有简体中文和英语，所以只返回这两种语言
  private useLang(): AvailableLanguages {
    if (lang.type === 'zh-cn' || lang.type === 'zh-tw') {
      return 'zh-cn'
    }
    return 'en'
  }

  /** 储存每种语言的 Wiki 首页路径 */
  private home: { [key in AvailableLanguages]: string } = {
    'zh-cn': '',
    en: '',
  }

  private resetHomeConfig() {
    let HomePrefix = 'https://xuejianxianzun.github.io/PBDWiki/'
    if (settings.debugForWiki) {
      HomePrefix = 'http://localhost:3000/'
    }
    this.home['zh-cn'] = HomePrefix + '#/zh-cn/'
    this.home['en'] = HomePrefix + '#/en/'
  }

  /** 设置每个设置项名称上的 href 属性 */
  private setOptionLink() {
    this.resetHomeConfig()
    // 查找所有 a.settingNameStyle 元素，并把它们的 href 属性修改为对应语言的 URL
    const allLinks = document.querySelectorAll(
      '.centerWrap_con a.settingNameStyle'
    )
    allLinks.forEach(async (el) => {
      // 查找其所属的选项元素，如 <div class='option' data-no='0'>
      const option = el.closest('.option') as HTMLDivElement
      if (option && option.dataset.no) {
        const id = Number(option.dataset.no)
        const link = await this.link(id)
        el.setAttribute('href', link)
      }
    })
  }

  /** 为每个功能按钮绑定事件，长按时生成 Wiki 链接并打开 */
  public registerBtn(btn: HTMLButtonElement) {
    Utils.longPress(btn, async () => {
      const link = await this.link(btn.id)
      window.open(link, '_blank')
    })
  }

  /**传入设置项或按钮的 ID，查找它在 Wiki 上处于哪个页面里，并构造出 URL */
  // 返回的 URL 只定位到分类页面，不会定位到具体的条目，但是会传递该设置的 flag，例如：
  // https://xuejianxianzun.github.io/PBDWiki/#/zh-cn/设置-抓取?flag=0
  // 之后由 Wiki 页面上的代码定位到具体的设置项
  // 如果传入的 ID 没有找到对应的分类，则返回 Wiki 首页
  public async link(id: number | string): Promise<string> {
    if (id === undefined) {
      console.error('link id is undefined')
      console.trace()
      return ''
    }

    await states.waitSettingInitialized()

    const lang = this.useLang()
    for (const [groupName, ids] of Object.entries(this.WikiConfig)) {
      if (ids.includes(id)) {
        const home = this.home[lang]
        const path = groupName + '-' + lang
        // 每个 id 的 path 是其分类名字 + `-` + 语言，例如 `Buttons-Crawl-zh-cn`
        return `${home}${path}?flag=${id}`
      }
    }
    return ''
  }
}

const wiki = new Wiki()
export { wiki }
