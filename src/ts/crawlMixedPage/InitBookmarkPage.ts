// 初始化新版收藏页面
import { InitPageBase } from '../crawl/InitPageBase'
import { API } from '../API'
import { lang } from '../Language'
import { IDData } from '../store/StoreType'
import {
  ArtworkCommonData,
  BookmarkData,
  BookmarkResult,
} from '../crawl/CrawlResult'
import { store } from '../store/Store'
import { log } from '../Log'
import { Tools } from '../Tools'
import { token } from '../Token'
import { BookmarksAddTag } from '../pageFunciton/BookmarksAddTag'
import { filter, FilterOption } from '../filter/Filter'
import { Utils } from '../utils/Utils'
import { Config } from '../Config'
import { states } from '../store/States'
import { toast } from '../Toast'
import { EVT } from '../EVT'
import { bookmark } from '../Bookmark'
import { showOneTimeMsg } from '../ShowOneTimeMsg'
import { msgBox } from '../MsgBox'
import { settings } from '../setting/Settings'
import { pageType } from '../PageType'
import { RemoveWorksTagsAction } from './bookmarkActions/RemoveWorksTagsAction'
import { UnBookmarkAllWorksAction } from './bookmarkActions/UnBookmarkAllWorksAction'
import { FindBookmark404Action } from './bookmarkActions/FindBookmark404Action'
import { UnBookmarkAll404WorksAction } from './bookmarkActions/UnBookmarkAll404WorksAction'
import { ExportBookmarkListAction } from './bookmarkActions/ExportBookmarkListAction'
import { ImportBookmarkListAction } from './bookmarkActions/ImportBookmarkListAction'

class InitBookmarkPage extends InitPageBase {
  constructor() {
    super()
    this.init()
  }

  /** 储存从列表页获取到的作品 id */
  private idList: IDData[] = []

  private exportList: BookmarkResult[] = []

  /** 当前页面显示的是图片还是小说 */
  private type: 'illusts' | 'novels' = 'illusts'
  /** 每次请求的偏移量 */
  private offset = 0
  /** 当前页面是否显示的是非公开收藏 */
  private isHide = false
  /** 最新或最旧排序。desc 是按最新排序，asc 是按最早排序 */
  private order: 'desc' | 'asc' = 'desc'
  /** 年龄限制模式。可能是 all、safe、r18（含 R-18G） */
  private mode: 'all' | 'safe' | 'r18' = 'all'
  /** 当前查询的作品标签，可能为空 */
  private work_tag = ''
  /** 当前查询的收藏时间，可能为空 */
  private bm = ''

  /** 根据页数，计算要抓取的作品个数 */
  private requsetNumber = 0
  /** 每次请求多少个数量，是 100 个。同时 API 里也是每次请求 100 个 */
  private readonly onceRequest = 100
  /** 记录检查了多少作品（不论结果是否通过都计入） */
  private filteredNumber = 0

  protected addCrawlBtns() {
    this.addInitPageBtn(
      'crawlBtns',
      '_开始抓取',
      '_默认下载多页',
      'startCrawling',
      'brand'
    ).addEventListener('click', () => {
      this.readyCrawl()
    })

    this.addStartTimedCrawlBtn(this.readyCrawl.bind(this))
    this.addCancelTimedCrawlBtn()
  }

  protected getWantPage() {
    this.crawlNumber = settings.crawlNumber[pageType.type].value
    if (this.crawlNumber === -1) {
      log.warning(lang.transl('_抓取所有页面'))
    } else {
      log.warning(
        lang.transl('_从本页开始抓取x页', this.crawlNumber.toString())
      )
    }
  }

  protected addAnyElement() {
    // 如果不存在 token，则不添加与收藏相关的按钮
    if (!token.token) {
      return
    }

    // 显示提示
    window.setTimeout(() => {
      showOneTimeMsg.show(
        'tipBookmarkManage',
        lang.transl('_在收藏页面里提示有辅助功能可用')
      )
    }, 1000)

    // 有些功能按钮只能在用户自己的页面里使用
    // 判断这个收藏页面是不是用户自己的页面
    const URLUserID = Utils.getURLPathField(window.location.pathname, 'users')
    const ownPage = URLUserID && URLUserID === store.loggedUserID
    if (ownPage) {
      const btn = this.addInitPageBtn(
        'otherBtns',
        '_给未分类作品添加添加tag',
        '',
        'addTagToUnmarkedWork',
        'brand'
      )
      new BookmarksAddTag(btn)

      new RemoveWorksTagsAction(
        this.addInitPageBtn(
          'otherBtns',
          '_移除本页面中所有作品的标签',
          '',
          'removeTagsFromAllWorksOnPage',
          'warning'
        )
      )

      new UnBookmarkAllWorksAction(
        this.addInitPageBtn(
          'otherBtns',
          '_取消收藏本页面的所有作品',
          '',
          'unBookmarkAllWorksOnPage',
          'danger'
        )
      )

      new FindBookmark404Action(
        this.addInitPageBtn(
          'otherBtns',
          '_查找所有已被删除的作品',
          '',
          'findBookmark404Works',
          'brand'
        )
      )

      new UnBookmarkAll404WorksAction(
        this.addInitPageBtn(
          'otherBtns',
          '_取消收藏所有已被删除的作品',
          '',
          'unBookmarkAll404Works',
          'danger'
        )
      )
    }

    new ExportBookmarkListAction(
      this.addInitPageBtn(
        'otherBtns',
        '_导出收藏列表',
        '',
        'exportBookmarkList',
        'brand'
      ),
      () => {
        this.exportBookmarkList()
      }
    )

    new ImportBookmarkListAction(
      this.addInitPageBtn(
        'otherBtns',
        '_导入收藏列表',
        '',
        'importBookmarkList',
        'brand'
      ),
      () => {
        this.importBookmarkIDList()
      }
    )
  }

  private bindExportEvent = false

  private exportBookmarkList() {
    if (states.busy) {
      toast.error(lang.transl('_当前任务尚未完成'))
      return
    }

    states.exportIDList = true
    this.exportList = []
    EVT.fire('closeCenterPanel')

    this.readyCrawl()
    log.log(lang.transl('_导出收藏列表'))
    log.log('')

    if (this.bindExportEvent === false) {
      window.addEventListener(EVT.list.getIdListFinished, async () => {
        if (!states.exportIDList) {
          return
        }

        window.setTimeout(() => {
          states.exportIDList = false
        }, 500)

        if (this.exportList.length === 0) {
          return
        }

        const resultList = await Utils.json2BlobSafe(this.exportList)
        for (const result of resultList) {
          Utils.downloadFile(
            result.url,
            `Bookmark list-total ${
              result.total
            }-from ${Tools.getPageTitle()}-${Utils.replaceUnsafeStr(
              new Date().toLocaleString()
            )}.json`
          )
        }

        const msg = lang.transl('_导出收藏列表')
        log.success('✅' + msg)
        toast.success(msg)
      })

      this.bindExportEvent = true
    }
  }

  private async importBookmarkIDList() {
    const loadedJSON = (await Utils.loadJSONFile().catch((err) => {
      return msgBox.error(err)
    })) as BookmarkResult[]
    if (!loadedJSON) {
      return
    }

    if (!Array.isArray(loadedJSON) || !loadedJSON.length || !loadedJSON[0]) {
      return toast.error(lang.transl('_格式错误'))
    }

    const keys = Object.keys(loadedJSON[0])
    const need = ['id', 'type', 'tags']
    for (const field of need) {
      if (!keys.includes(field)) {
        return toast.error(lang.transl('_格式错误'))
      }
    }

    const tip = lang.transl('_导入收藏列表')
    toast.success(tip)
    log.success('🚀' + tip)
    log.log(lang.transl('_作品数量') + ` ${loadedJSON.length}`)
    log.warning(lang.transl('_提示会跳过已收藏的作品'))

    EVT.fire('closeCenterPanel')

    let oldList: BookmarkResult[] = []
    if (loadedJSON.length > 200) {
      log.log(lang.transl('_加载收藏列表'))
      const userID = store.loggedUserID
      const loadIllust = loadedJSON.some((item) => item.type === 'illusts')
      const loadNovel = loadedJSON.some((item) => item.type === 'novels')
      if (loadIllust) {
        log.log(lang.transl('_插画') + ', ' + lang.transl('_公开'))
        const illustsPublic = await bookmark.getAllBookmarkList(
          userID,
          'illusts',
          '',
          0,
          false
        )

        log.log(lang.transl('_插画') + ', ' + lang.transl('_不公开'))
        const illustsPrivate = await bookmark.getAllBookmarkList(
          userID,
          'illusts',
          '',
          0,
          true
        )

        oldList = oldList.concat(illustsPublic, illustsPrivate)
      }
      if (loadNovel) {
        log.log(lang.transl('_小说') + ', ' + lang.transl('_公开'))
        const novelsPublic = await bookmark.getAllBookmarkList(
          userID,
          'novels',
          '',
          0,
          false
        )

        log.log(lang.transl('_小说') + ', ' + lang.transl('_不公开'))
        const novelsPrivate = await bookmark.getAllBookmarkList(
          userID,
          'novels',
          '',
          0,
          true
        )

        oldList = oldList.concat(novelsPublic, novelsPrivate)
      }

      log.log(lang.transl('_一共有x个', oldList.length.toString()))
    }

    bookmark.addBookmarksInBatchs(loadedJSON, oldList)
  }

  protected nextStep() {
    this.setSlowCrawl()
    this.readyGetIdList()
    this.getIdList()
  }

  protected readyGetIdList() {
    if (window.location.pathname.includes('/collections')) {
      const msg = lang.transl('_下载器目前不支持抓取珍藏册')
      msgBox.warning(msg)
      log.warning(msg)
      EVT.fire('stopCrawl')
      return
    }

    if (window.location.pathname.includes('/novel')) {
      this.type = 'novels'
    }

    const onceNumber = window.location.pathname.includes('/novels') ? 30 : 48
    const nowPage = Utils.getURLSearchField(location.href, 'p')
    if (nowPage) {
      this.offset = (Number.parseInt(nowPage) - 1) * onceNumber
    }
    if (this.offset < 0) {
      this.offset = 0
    }

    if (this.crawlNumber === -1) {
      this.requsetNumber = Config.worksNumberLimit
    } else {
      this.requsetNumber = onceNumber * this.crawlNumber
    }

    store.tag = Tools.getTagFromURL()
    this.isHide = Utils.getURLSearchField(location.href, 'rest') === 'hide'
    this.order = (Utils.getURLSearchField(location.href, 'order') ||
      'desc') as 'desc' | 'asc'
    this.mode = (Utils.getURLSearchField(location.href, 'mode') ||
      'all') as 'all' | 'safe' | 'r18'
    this.work_tag = Utils.getURLSearchField(location.href, 'work_tag') || ''
    this.bm =
      Utils.getURLSearchField(location.href, 'bm').replaceAll('-', '') || ''

    log.log(lang.transl('_正在抓取'))
    if (this.crawlNumber === -1) {
      log.log(lang.transl('_获取全部书签作品'))
    }
  }

  protected async getIdList() {
    if (states.stopCrawl) {
      return this.getIdListFinished()
    }

    let data: BookmarkData
    try {
      data = await API.getBookmarkData(
        Tools.getCurrentPageUserID(),
        this.type,
        store.tag,
        this.offset,
        this.isHide,
        this.order,
        this.mode,
        this.work_tag,
        this.bm
      )
    } catch (error) {
      if ((error as any).message.includes('not valid JSON')) {
        if (lang.type.includes('zh')) {
          log.error(`预期的数据格式为 JSON，但抓取结果不是 JSON。已取消抓取。<br>
一种可能的原因：您已被 Pixiv 封禁。`)
        } else {
          log.error(`Expected data format is JSON, but the fetch result is not JSON. Fetch has been canceled. <br>
One possible reason: You have been banned from Pixiv.`)
        }
        return this.getIdListFinished()
      }
      this.getIdList()
      return
    }

    if (states.stopCrawl) {
      return this.getIdListFinished()
    }

    if (
      data.body.works.length === 0 ||
      this.idList.length >= this.requsetNumber ||
      this.filteredNumber >= this.requsetNumber
    ) {
      if (this.idList.length > this.requsetNumber) {
        this.idList.splice(this.requsetNumber, this.idList.length)
      }
      if (this.exportList.length > this.requsetNumber) {
        this.exportList.splice(this.requsetNumber, this.exportList.length)
      }
      store.idList = store.idList.concat(this.idList)
      return this.getIdListFinished()
    }

    for (const workData of data.body.works) {
      if (this.filteredNumber >= this.requsetNumber) {
        break
      }

      const filterOpt: FilterOption = {
        aiType: workData.aiType,
        id: workData.id,
        isOriginal: workData.isOriginal,
        tags: workData.tags,
        title: workData.title,
        bookmarkData: workData.bookmarkData,
        createDate: workData.createDate,
        userId: workData.userId,
        xRestrict: workData.xRestrict,
      }

      this.filteredNumber++

      if (await filter.check(filterOpt)) {
        this.idList.push({
          type:
            (workData as ArtworkCommonData).illustType === undefined
              ? 'novels'
              : Tools.getWorkTypeString(
                  (workData as ArtworkCommonData).illustType
                ),
          id: workData.id,
        })

        if (states.exportIDList) {
          this.exportList.push({
            id: workData.id,
            type:
              (workData as ArtworkCommonData).illustType === undefined
                ? 'novels'
                : 'illusts',
            tags: workData.tags,
            restrict: workData.bookmarkData?.private || false,
          })
        }
      }
    }

    this.offset += this.onceRequest
    log.log(
      lang.transl('_当前有x个作品', this.idList.length.toString()),
      'initBookmarkPageCrawlCount'
    )

    if (states.slowCrawlMode) {
      await Utils.sleep(settings.slowCrawlDealy)
    }
    this.getIdList()
  }

  protected resetGetIdListStatus() {
    this.type = 'illusts'
    this.idList = []
    this.offset = 0
    this.requsetNumber = 0
    this.filteredNumber = 0
  }
}

export { InitBookmarkPage }
