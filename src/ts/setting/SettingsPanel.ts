import browser from 'webextension-polyfill'
import { Config } from '../Config'
import { EVT } from '../EVT'
import { lang } from '../Language'
import { LangTextKey } from '../langText'
import { msgBox } from '../MsgBox'
import { store } from '../store/Store'
import { Utils } from '../utils/Utils'
import { theme } from '../Theme'
import { states } from '../store/States'
import { bg } from '../BG'
import { BoldKeywords } from '../BoldKeywords'
import { showOneTimeMsg } from '../ShowOneTimeMsg'
import { optionConfigs } from './OptionConfigs'
import { OptionCategoryLevel1, settings, setSetting } from './Settings'
import { SettingsForm } from './SettingsForm'
import { SettingsPanelDownloadSummary } from './SettingsPanelDownloadSummary'
import { SettingsPanelHelp } from './SettingsPanelHelp'
import { SearchRestorePage, SettingsPanelSearch } from './SettingsPanelSearch'
import { FoldableSection, PageId, PersistedPageId } from './SettingsPanelTypes'
import '../OpenSettingsPanel'

const pageIds: PageId[] = [
  'home',
  'crawl',
  'naming',
  'download',
  'enhance',
  'general',
  'help',
  'search',
]

class SettingsPanel {
  constructor(form: SettingsForm) {
    SettingsPanel.initShell()
    this.form = form
    this.centerPanel = SettingsPanel.getShell()
    this.main = this.centerPanel.querySelector(
      '.settingsPanel_main'
    ) as HTMLDivElement

    if (!this.centerPanel || !this.main) {
      throw new Error('SettingsPanel shell not found')
    }

    for (const option of this.form.querySelectorAll('.option')) {
      const no = Number.parseInt((option as HTMLElement).dataset.no || '-1')
      if (no > -1) {
        this.optionElements.set(no, option as HTMLElement)
      }
    }

    this.cacheShellElements()
    this.buildLayout()
    this.downloadSummary = new SettingsPanelDownloadSummary(
      this.centerPanel.querySelector(
        '#settingsPanelDownloadSummary'
      ) as HTMLDivElement,
      this.form
    )
    this.bindEvents()
    this.switchPage('home')
    this.updateSearchResult()
  }

  private form: SettingsForm
  private centerPanel: HTMLDivElement
  private main: HTMLDivElement

  private static shell?: HTMLDivElement
  private static allLangFlag: string[] = []

  public static initShell() {
    if (this.shell) {
      return this.shell
    }

    const centerPanelHTML = `
      <div class="centerWrap settingsV2 ${'lang_' + lang.type}">
        <div class="centerWrap_head">
          <div class="settingsPanel_headerMain">
            <div class="settingsPanel_brand">
              <svg class="icon settingsPanel_logo" aria-hidden="true"><use xlink:href="#logo128"></use></svg>
              <span class="settingsPanel_brandName">${Config.appName}</span>
            </div>

            <button class="textButton centerWrap_top_btn centerWrap_close centerWrap_close_mobile" type="button" data-xztitle="_关闭">
              <svg class="icon" aria-hidden="true">
                <use xlink:href="#close"></use>
              </svg>
            </button>
          </div>

          <div class="settingsPanel_headerActions">
            <div class="settingsPanel_headerSearch">
              <label class="settingsPanel_searchBar">
                <svg class="icon settingsPanel_searchIcon" aria-hidden="true">
                  <use xlink:href="#search-in-searchbar"></use>
                </svg>
                <input id="settingsPanelSearchInput" type="text" data-xzplaceholder="_搜索设置">
                <button class="textButton settingsPanel_clearSearch" id="settingsPanelClearSearch" type="button" data-xztitle="_清除">
                  <svg class="icon" aria-hidden="true">
                    <use xlink:href="#close"></use>
                  </svg>
                </button>
              </label>

              <button class="textButton centerWrap_top_btn settingsPanel_expandAll" id="settingsPanelToggleExpand" type="button" data-xztitle="_展开/折叠所有区域">
                <svg class="icon settingsPanel_expandIcon" aria-hidden="true">
                  <use xlink:href="#arrow-up"></use>
                </svg>
              </button>
            </div>

            <div class="settingsPanel_headerMinor">
              <button class="textButton centerWrap_top_btn settingsPanel_sponsorBtn" id="settingsPanelSponsor" type="button" data-xztitle="_赞助我">
                <svg class="icon" aria-hidden="true">
                  <use xlink:href="#heart-line"></use>
                </svg>
              </button>
            </div>

            <div class="settingsPanel_headerClose">
              <button class="textButton centerWrap_top_btn centerWrap_close centerWrap_close_pc" type="button" data-xztitle="_关闭">
                <svg class="icon" aria-hidden="true">
                  <use xlink:href="#close"></use>
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div class="centerWrap_con">
          <aside class="settingsPanel_sidebar beautify_scrollbar">
            <nav class="settingsPanel_nav">
              ${this.createNavItem('home', '_首页', 'home-line', 'home-fill')}
              ${this.createNavItem('crawl', '_抓取', 'filter-line', 'filter-filling')}
              ${this.createNavItem('naming', '_命名', 'rename-line', 'rename-fill')}
              ${this.createNavItem('download', '_下载', 'download-line', 'download-fill')}
              ${this.createNavItem('enhance', '_增强', 'magic-line', 'magic-fill')}
              ${this.createNavItem('general', '_通用', 'setting-line', 'setting-fill')}
              ${this.createNavItem('help', '_帮助', 'book-line', 'book-fill')}
              ${this.createNavItem('search', '_搜索', 'search-line', 'search-fill', true)}
            </nav>

            <div class="settingsPanel_downloadSummary" id="settingsPanelDownloadSummary">
              <div class="settingsPanel_downloadSummaryStatus">
                <svg class="icon settingsPanel_downloadSummaryStateIcon" aria-hidden="true">
                  <use xlink:href="#start"></use>
                </svg>
                <span class="settingsPanel_downloadSummaryProgress">0 / 0</span>
              </div>

              <div class="settingsPanel_downloadSummaryActions">
                <button class="textButton settingsPanel_downloadSummaryBtn" id="settingsPanelSummaryStart" type="button" data-xztitle="_开始下载">
                  <svg class="icon" aria-hidden="true"><use xlink:href="#start"></use></svg>
                </button>
                <button class="textButton settingsPanel_downloadSummaryBtn" id="settingsPanelSummaryPause" type="button" data-xztitle="_暂停下载">
                  <svg class="icon" aria-hidden="true"><use xlink:href="#pause"></use></svg>
                </button>
                <button class="textButton settingsPanel_downloadSummaryBtn" id="settingsPanelSummaryStop" type="button" data-xztitle="_停止下载">
                  <svg class="icon" aria-hidden="true"><use xlink:href="#stop"></use></svg>
                </button>
              </div>
            </div>
          </aside>

          <div class="settingsPanel_main beautify_scrollbar">
            <slot data-name="form"></slot>
          </div>
        </div>
      </div>
    `

    document.body.insertAdjacentHTML('afterbegin', centerPanelHTML)
    this.shell = document.querySelector(
      '.centerWrap.settingsV2'
    ) as HTMLDivElement
    if (!this.shell) {
      throw new Error('SettingsPanel shell not found')
    }

    if (Config.mobile) {
      document.body.classList.add('mobile')
      this.shell.classList.add('mobile')
    }

    theme.register(this.shell)
    lang.register(this.shell)
    bg.useBG(this.shell)
    new BoldKeywords(this.shell)

    this.allLangFlag = lang.langTypes.map((type) => 'lang_' + type)
    this.setLangFlag()
    this.bindShellEvents()
    return this.shell
  }

  private static getShell() {
    return this.initShell()
  }

  private static createNavItem(
    page: string,
    textKey: string,
    lineIcon: string,
    fillIcon: string,
    hidden = false
  ) {
    return `
    <button class="settingsPanel_navItem hasRippleAnimation" data-page="${page}" type="button" ${
      hidden ? 'hidden' : ''
    }>
      <span class="settingsPanel_navIconWrap" aria-hidden="true">
        <svg class="icon settingsPanel_navIcon settingsPanel_navIconLine">
          <use xlink:href="#${lineIcon}"></use>
        </svg>
        <svg class="icon settingsPanel_navIcon settingsPanel_navIconFill">
          <use xlink:href="#${fillIcon}"></use>
        </svg>
      </span>
      <span class="settingsPanel_navText" data-xztext="${textKey}"></span>
      <span class="ripple"></span>
    </button>
    `
  }

  private static setLangFlag() {
    const shell = this.getShell()
    this.allLangFlag.forEach((flag) => {
      shell.classList.remove(flag)
    })
    shell.classList.add('lang_' + lang.type)
  }

  private static bindShellEvents() {
    const shell = this.getShell()

    browser.runtime.onMessage.addListener((msg: any) => {
      if (msg.msg === 'click_icon') {
        this.toggleShell()
      }
    })

    window.addEventListener(EVT.list.settingInitialized, () => {
      showOneTimeMsg.show(
        'tipHowToUse',
        lang.transl('_HowToUse') + lang.transl('_账户可能被封禁的警告')
      )
    })

    window.addEventListener(
      'keydown',
      (ev) => {
        if (ev.altKey && ev.code === 'KeyX') {
          this.toggleShell()
        }
      },
      false
    )

    shell.querySelectorAll('.centerWrap_close').forEach((button) =>
      button.addEventListener('click', () => {
        EVT.fire('closeCenterPanel')
        if (!Config.mobile) {
          showOneTimeMsg.show(
            'tipAltXToShowControlPanel',
            lang.transl('_快捷键ALTX显示隐藏控制面板')
          )
        }
      })
    )

    shell
      .querySelector('#settingsPanelSponsor')
      ?.addEventListener('click', () =>
        msgBox.show(lang.transl('_赞助方式提示'), {
          title: lang.transl('_赞助我'),
        })
      )

    window.addEventListener(EVT.list.crawlStart, () => {
      EVT.fire('closeCenterPanel')
    })

    for (const ev of [EVT.list.crawlComplete, EVT.list.resume]) {
      window.addEventListener(ev, () => {
        if (!states.quickCrawl && store.result.length > 0) {
          this.showShell()
        }
      })
    }

    window.addEventListener(EVT.list.openCenterPanel, () => {
      this.showShell()
    })

    window.addEventListener(EVT.list.closeCenterPanel, () => {
      this.closeShell()
    })

    window.addEventListener(EVT.list.langChange, () => {
      this.setLangFlag()
    })

    shell.addEventListener('click', (e) => {
      e.stopPropagation()
    })

    document.addEventListener('click', () => {
      if (getComputedStyle(shell).display !== 'none') {
        EVT.fire('closeCenterPanel')
      }
    })
  }

  private static showShell() {
    this.getShell().style.display = 'block'
    EVT.fire('centerPanelOpened')
  }

  private static closeShell() {
    this.getShell().style.display = 'none'
    EVT.fire('centerPanelClosed')
  }

  private static toggleShell() {
    const shell = this.getShell()
    const nowDisplay = shell.style.display
    nowDisplay === 'block' ? this.closeShell() : this.showShell()
    if (nowDisplay === 'block') {
      EVT.fire('closeCenterPanel')
    } else {
      EVT.fire('openCenterPanel')
    }
  }

  private activePage: PageId = 'home'
  private readonly optionElements = new Map<number, HTMLElement>()
  private readonly canonicalContainers = new Map<string, HTMLDivElement>()
  private readonly pageEls = new Map<PageId, HTMLDivElement>()
  private readonly pageInners = new Map<PageId, HTMLDivElement>()
  private readonly stickyEls = new Map<PageId, HTMLButtonElement>()
  private readonly navEls = new Map<PageId, HTMLButtonElement>()
  private readonly foldableSections = new Map<string, FoldableSection>()
  private expandAllBtn!: HTMLButtonElement
  private homePinnedContent!: HTMLDivElement
  private otherBtnsVisibilityObserver?: MutationObserver
  private downloadSummary!: SettingsPanelDownloadSummary
  private searchPanel!: SettingsPanelSearch

  private cacheShellElements() {
    this.expandAllBtn = this.centerPanel.querySelector(
      '#settingsPanelToggleExpand'
    ) as HTMLButtonElement

    const navButtons = this.centerPanel.querySelectorAll(
      '.settingsPanel_navItem'
    ) as NodeListOf<HTMLButtonElement>
    navButtons.forEach((button) => {
      this.navEls.set(button.dataset.page as PageId, button)
    })
  }

  private buildLayout() {
    const crawlBtnsBlock = this.findSlotBlock('stopCrawl')
    const otherBtnsBlock = this.findSlotBlock('otherBtns')
    const downloadBtnsBlock = this.findSlotBlock('exportResult')
    const downloadArea = this.findSlot('downloadArea')
    const progressBar = this.findSlot('progressBar')

    const pagesWrap = document.createElement('div')
    pagesWrap.className = 'settingsPanel_pages'

    this.form.classList.add('settingsPanel_form')
    this.form.replaceChildren(pagesWrap)

    pageIds.forEach((page) => {
      const pageEl = document.createElement('div')
      pageEl.className = 'settingsPanel_page'
      pageEl.dataset.page = page

      const sticky = document.createElement('button')
      sticky.type = 'button'
      sticky.className = 'settingsPanel_stickyHeader'
      sticky.hidden = true
      sticky.innerHTML = `
      <span class="settingsPanel_sectionHeadMain">
        <span class="settingsPanel_sectionIconWrap hidden">
          <svg class="icon" aria-hidden="true">
            <use xlink:href=""></use>
          </svg>
        </span>
        <span class="settingsPanel_sectionTitle"></span>
      </span>
      <svg class="icon settingsPanel_sectionArrow" aria-hidden="true">
        <use xlink:href="#arrow-down-2"></use>
      </svg>
      `
      pageEl.append(sticky)

      const inner = document.createElement('div')
      inner.className = 'settingsPanel_pageInner'
      pageEl.append(inner)

      pagesWrap.append(pageEl)
      this.pageEls.set(page, pageEl)
      this.pageInners.set(page, inner)
      this.stickyEls.set(page, sticky)

      sticky.addEventListener('click', () => {
        const key = sticky.dataset.sectionKey
        if (!key) {
          return
        }
        const section = this.foldableSections.get(key)
        if (section) {
          this.toggleSection(section)
          return
        }
        this.searchPanel.toggleSectionByKey(key)
      })
    })

    this.buildHomePage(
      crawlBtnsBlock,
      otherBtnsBlock,
      downloadBtnsBlock,
      downloadArea,
      progressBar
    )
    this.buildCategoryPages()
    this.buildHelpPage()
    this.buildSearchPage()

    for (const option of this.optionElements.values()) {
      option.classList.add('settingsPanel_optionCard')
    }

    lang.register(pagesWrap)
  }

  private buildHomePage(
    crawlBtnsBlock: HTMLDivElement,
    otherBtnsBlock: HTMLDivElement,
    downloadBtnsBlock: HTMLDivElement,
    downloadArea: HTMLElement,
    progressBar: HTMLElement
  ) {
    const home = this.pageInners.get('home')!

    const homeTipsWrap = document.createElement('div')
    homeTipsWrap.className = 'settingsPanel_helpTips settingsPanel_homeTips'
    homeTipsWrap.innerHTML = `
    <div class="settingsPanel_tipCard" id="tipCloseAskFileSaveLocation">
      <svg class="icon settingsPanel_tipIcon" aria-hidden="true"><use xlink:href="#light-line"></use></svg>
      <div class="settingsPanel_tipText">
        <span class="settingsPanel_tipTextContent">
          <span data-xztext="_建议您关闭询问文件保存位置"></span>
          <button class="settingsPanel_tipConfirm" type="button" data-xztitle="_已确认">
            <svg class="icon" aria-hidden="true"><use xlink:href="#yes"></use></svg>
          </button>
        </span>
      </div>
    </div>
    `
    home.append(homeTipsWrap)

    const pinnedSection = this.createSection({
      page: 'home',
      id: 'pinnedOptions',
      titleKey: '_置顶的设置',
      iconId: 'pin-line',
      persisted: true,
      stickyEligible: true,
      type: 'title',
    })
    home.append(pinnedSection.root)
    this.homePinnedContent = pinnedSection.content

    const crawlBlock = this.createSection({
      page: 'home',
      id: 'crawlBtns',
      titleKey: '_开始抓取',
      iconId: 'rocket',
      persisted: true,
      stickyEligible: false,
      type: 'panel',
    })
    crawlBlock.content.append(crawlBtnsBlock)
    home.append(crawlBlock.root)

    const otherBlock = this.createSection({
      page: 'home',
      id: 'otherBtns',
      titleKey: '_附加功能',
      iconId: 'features',
      persisted: true,
      stickyEligible: false,
      type: 'panel',
    })
    otherBlock.content.append(otherBtnsBlock)
    home.append(otherBlock.root)
    this.bindHomeOtherBtnsVisibility(otherBlock, otherBtnsBlock)

    const downloadBlock = this.createSection({
      page: 'home',
      id: 'downloadArea',
      titleKey: '_下载区域',
      iconId: 'download',
      persisted: true,
      stickyEligible: false,
      type: 'panel',
    })
    const downloadContentWrap = document.createElement('div')
    downloadContentWrap.className = 'settingsPanel_downloadContentWrap'
    downloadContentWrap.append(downloadBtnsBlock, downloadArea, progressBar)
    downloadBlock.content.append(downloadContentWrap)
    home.append(downloadBlock.root)
  }

  private bindHomeOtherBtnsVisibility(
    otherBlock: FoldableSection,
    otherBtnsBlock: HTMLDivElement
  ) {
    const toggleOtherBlock = () => {
      const hasButtons = otherBtnsBlock.querySelector('button') !== null
      otherBlock.root.style.display = hasButtons ? '' : 'none'
    }

    toggleOtherBlock()

    this.otherBtnsVisibilityObserver?.disconnect()
    this.otherBtnsVisibilityObserver = new MutationObserver(() => {
      toggleOtherBlock()
    })
    this.otherBtnsVisibilityObserver.observe(otherBtnsBlock, {
      childList: true,
      subtree: true,
    })
  }

  private buildCategoryPages() {
    const allCategories = Object.keys(
      optionConfigs.categorySchema
    ) as OptionCategoryLevel1[]

    allCategories.forEach((page) => {
      const inner = this.pageInners.get(page)!
      const groups = Object.values(
        optionConfigs.categorySchema[page].level2
      ).sort((a, b) => a.order - b.order)

      groups.forEach((group) => {
        const section = this.createSection({
          page,
          id: group.id,
          titleKey: group.nameKey,
          iconId: group.icon,
          persisted: true,
          stickyEligible: true,
          type: 'title',
        })
        inner.append(section.root)
        this.canonicalContainers.set(
          this.makeCanonicalKey(page, group.id),
          section.content
        )
      })
    })
  }

  private buildHelpPage() {
    const help = this.pageInners.get('help')!
    new SettingsPanelHelp(help)
  }

  private buildSearchPage() {
    this.searchPanel = new SettingsPanelSearch({
      root: this.pageInners.get('search')!,
      input: this.centerPanel.querySelector(
        '#settingsPanelSearchInput'
      ) as HTMLInputElement,
      clearButton: this.centerPanel.querySelector(
        '#settingsPanelClearSearch'
      ) as HTMLButtonElement,
      navButton: this.centerPanel.querySelector(
        '.settingsPanel_navItem[data-page="search"]'
      ) as HTMLButtonElement,
      optionElements: this.optionElements,
      getCanonicalContainer: (level1, level2) =>
        this.getCanonicalContainer(level1, level2),
      onSectionStateChange: () => {
        this.updateExpandAllButton()
        this.refreshStickyHeader()
      },
    })
  }

  private createSection({
    page,
    id,
    titleKey,
    iconId,
    persisted,
    stickyEligible,
    type,
  }: {
    page: PageId
    id: string
    titleKey: LangTextKey
    iconId?: string
    persisted: boolean
    stickyEligible: boolean
    type: 'title' | 'panel'
  }) {
    const root = document.createElement('div')
    root.className =
      type === 'panel'
        ? 'settingsPanel_panelSection'
        : 'settingsPanel_titleSection'

    const header = document.createElement('button')
    header.type = 'button'
    header.className = 'settingsPanel_sectionHeader'
    root.append(header)

    const headerMain = document.createElement('span')
    headerMain.className = 'settingsPanel_sectionHeadMain'
    header.append(headerMain)

    let iconUse: SVGUseElement | undefined
    if (iconId) {
      const iconWrap = document.createElement('span')
      iconWrap.className = 'settingsPanel_sectionIconWrap'
      iconWrap.innerHTML = `
      <svg class="icon" aria-hidden="true">
        <use xlink:href="#${iconId}"></use>
      </svg>
      `
      headerMain.append(iconWrap)
      iconUse = iconWrap.querySelector('use') as SVGUseElement
    }

    const title = document.createElement('span')
    title.className = 'settingsPanel_sectionTitle'
    title.dataset.xztext = titleKey
    headerMain.append(title)

    const arrow = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'svg'
    ) as SVGSVGElement
    arrow.setAttribute('class', 'icon settingsPanel_sectionArrow')
    arrow.setAttribute('aria-hidden', 'true')
    const arrowUse = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'use'
    )
    arrowUse.setAttributeNS(
      'http://www.w3.org/1999/xlink',
      'xlink:href',
      '#arrow-down-2'
    )
    arrow.append(arrowUse)
    header.append(arrow)

    const contentShell = document.createElement('div')
    contentShell.className =
      type === 'panel'
        ? 'settingsPanel_sectionContentShell settingsPanel_panelContentShell'
        : 'settingsPanel_sectionContentShell settingsPanel_titleContentShell'
    root.append(contentShell)

    const contentWrap = document.createElement('div')
    contentWrap.className = 'settingsPanel_sectionContentWrap'
    contentShell.append(contentWrap)

    const content = document.createElement('div')
    content.className =
      type === 'panel'
        ? 'settingsPanel_panelContent'
        : 'settingsPanel_titleContent'
    contentWrap.append(content)

    const section: FoldableSection = {
      page,
      id,
      persisted,
      stickyEligible,
      root,
      header,
      contentShell,
      contentWrap,
      content,
      title,
      iconUse,
    }
    const key = this.makeSectionKey(page, id)
    this.foldableSections.set(key, section)
    header.dataset.sectionKey = key

    this.applyExpandedState(section, this.getExpandedState(section))

    header.addEventListener('click', () => this.toggleSection(section))
    header.addEventListener('keydown', (event) => {
      if (event.code === 'Enter' || event.code === 'Space') {
        event.preventDefault()
        this.toggleSection(section)
      }
    })

    return section
  }

  private bindEvents() {
    this.navEls.forEach((button, page) => {
      button.addEventListener('click', () => {
        this.playNavRipple(button)
        this.handleNavRequest(page)
      })
      button.addEventListener('keydown', (event) => {
        if (
          (event.code === 'Enter' || event.code === 'Space') &&
          event.target === button
        ) {
          event.preventDefault()
          this.playNavRipple(button)
          this.handleNavRequest(page)
        }
      })

      if (!Config.mobile) {
        button.addEventListener('mouseenter', () => {
          if (settings.switchTabBar !== 'click') {
            this.handleNavRequest(page)
          }
        })
      }
    })

    this.searchPanel.bindEvents(() => this.updateSearchResult())

    this.expandAllBtn.addEventListener('click', () => this.toggleAllSections())

    this.main.addEventListener('scroll', () => this.refreshStickyHeader())

    window.addEventListener(EVT.list.settingChange, (ev: CustomEventInit) => {
      const data = ev.detail.data as any
      if (data.name === 'pinnedOptions') {
        this.renderCurrentPage()
      }

      if (data.name === 'expandedCards') {
        this.refreshPersistedSectionStates()
      }
    })

    window.addEventListener(EVT.list.langChange, () => {
      window.setTimeout(() => {
        this.renderCurrentPage()
      }, 0)
    })
  }

  private handleNavRequest(page: PageId) {
    if (page === 'search' && !this.searchPanel.hasKeyword()) {
      return
    }

    if (this.searchPanel.hasKeyword() && page !== 'search') {
      this.searchPanel.setLastNonSearchPage(page as SearchRestorePage)
      if (this.activePage === 'search') {
        this.searchPanel.clear()
        this.updateSearchResult()
      }
      return
    }

    this.switchPage(page)
  }

  private switchPage(page: PageId) {
    this.activePage = page
    if (page !== 'search') {
      this.searchPanel.setLastNonSearchPage(page as SearchRestorePage)
    }

    this.pageEls.forEach((pageEl, key) => {
      pageEl.classList.toggle('active', key === page)
    })
    this.navEls.forEach((button, key) => {
      button.classList.toggle('active', key === page)
    })

    this.renderCurrentPage()
  }

  private renderCurrentPage() {
    if (this.activePage === 'search') {
      this.searchPanel.renderPage()
    } else {
      this.placeOptionsToDefaultContainers(this.activePage === 'home')
    }

    this.updatePinnedSectionVisibility()
    this.updateExpandAllButton()
    window.setTimeout(() => this.refreshStickyHeader(), 0)
  }

  private updateSearchResult() {
    if (!this.searchPanel.updateResult()) {
      this.switchPage(this.searchPanel.getLastNonSearchPage())
      return
    }

    this.switchPage('search')
  }

  private placeOptionsToDefaultContainers(showPinnedOnHome: boolean) {
    for (const option of optionConfigs.options) {
      const element = this.optionElements.get(option.no)
      if (!element) {
        continue
      }

      const target =
        showPinnedOnHome && settings.pinnedOptions.includes(option.no)
          ? this.homePinnedContent
          : this.getCanonicalContainer(
              option.categoryLevel1,
              option.categoryLevel2
            )
      target.append(element)
    }

    this.searchPanel.resetOptionHighlight()
  }

  private toggleSection(section: FoldableSection) {
    const expanded = !this.getExpandedState(section)
    this.setExpandedState(section, expanded)
    this.updateExpandAllButton()
    this.refreshStickyHeader()
  }

  private getExpandedState(section: FoldableSection) {
    const pageState = this.getPersistedPageState(
      section.page as PersistedPageId
    )
    return !!pageState?.[section.id]
  }

  private setExpandedState(section: FoldableSection, expanded: boolean) {
    const nextExpandedCards = Utils.deepCopy(settings.expandedCards)
    const pageState = this.getPersistedPageState(
      section.page as PersistedPageId,
      nextExpandedCards
    )
    if (pageState) {
      pageState[section.id] = expanded
    }
    setSetting('expandedCards', nextExpandedCards)
    this.applyExpandedState(section, expanded)
  }

  private applyExpandedState(section: FoldableSection, expanded: boolean) {
    section.root.classList.toggle('expanded', expanded)
    section.root.classList.toggle('collapsed', !expanded)
    section.header.setAttribute('aria-expanded', expanded ? 'true' : 'false')
    section.contentWrap.toggleAttribute('inert', !expanded)
    section.contentWrap.setAttribute('aria-hidden', expanded ? 'false' : 'true')
  }

  private refreshPersistedSectionStates() {
    this.foldableSections.forEach((section) => {
      this.applyExpandedState(section, this.getExpandedState(section))
    })
    this.updateExpandAllButton()
    this.refreshStickyHeader()
  }

  private toggleAllSections() {
    const shouldExpand = !this.areAllSectionsExpanded()
    const nextExpandedCards = Utils.deepCopy(settings.expandedCards)

    this.foldableSections.forEach((section) => {
      const pageState = this.getPersistedPageState(
        section.page as PersistedPageId,
        nextExpandedCards
      )
      if (pageState) {
        pageState[section.id] = shouldExpand
      }
      this.applyExpandedState(section, shouldExpand)
    })

    this.searchPanel.setAllExpanded(shouldExpand)

    setSetting('expandedCards', nextExpandedCards)
    this.updateExpandAllButton()
    this.refreshStickyHeader()
  }

  private areAllSectionsExpanded() {
    return this.getExpandAllState() === 'expanded'
  }

  private updateExpandAllButton() {
    const state = this.getExpandAllState()
    this.expandAllBtn.classList.toggle('expanded', state === 'expanded')
    this.expandAllBtn.classList.toggle('partial', state === 'partial')
  }

  private getExpandAllState(): 'collapsed' | 'partial' | 'expanded' {
    let total = 0
    let expanded = 0

    for (const section of this.foldableSections.values()) {
      total++
      if (this.getExpandedState(section)) {
        expanded++
      }
    }

    const searchStats = this.searchPanel.getExpandStats()
    total += searchStats.total
    expanded += searchStats.expanded

    if (total === 0 || expanded === 0) {
      return 'collapsed'
    }
    if (expanded === total) {
      return 'expanded'
    }
    return 'partial'
  }

  private refreshStickyHeader() {
    const sticky = this.stickyEls.get(this.activePage)
    if (!sticky) {
      return
    }

    const sections = this.getStickySectionsForActivePage()
    if (sections.length === 0) {
      sticky.hidden = true
      return
    }

    const mainRect = this.main.getBoundingClientRect()
    let current: FoldableSection | undefined

    for (const section of sections) {
      const headerRect = section.header.getBoundingClientRect()
      const rootRect = section.root.getBoundingClientRect()
      if (
        headerRect.top <= mainRect.top &&
        rootRect.bottom > mainRect.top + headerRect.height
      ) {
        current = section
      }
    }

    if (!current) {
      sticky.hidden = true
      return
    }

    sticky.hidden = false
    sticky.dataset.sectionKey = this.makeSectionKey(current.page, current.id)

    const stickyTitle = sticky.querySelector(
      '.settingsPanel_sectionTitle'
    ) as HTMLSpanElement
    stickyTitle.textContent = current.title.textContent || ''

    const stickyIconWrap = sticky.querySelector(
      '.settingsPanel_sectionIconWrap'
    ) as HTMLSpanElement
    const stickyIconUse = sticky.querySelector(
      '.settingsPanel_sectionIconWrap use'
    ) as SVGUseElement
    if (current.iconUse) {
      stickyIconWrap.classList.remove('hidden')
      stickyIconUse.setAttribute(
        'xlink:href',
        current.iconUse.getAttribute('xlink:href') || ''
      )
    } else {
      stickyIconWrap.classList.add('hidden')
      stickyIconUse.setAttribute('xlink:href', '')
    }
  }

  private getStickySectionsForActivePage() {
    if (this.activePage === 'search') {
      return this.searchPanel.getStickySections()
    }

    return [...this.foldableSections.values()].filter(
      (section) =>
        section.page === this.activePage &&
        section.stickyEligible &&
        this.getExpandedState(section)
    )
  }

  private updatePinnedSectionVisibility() {
    const pinnedSection = this.foldableSections.get(
      this.makeSectionKey('home', 'pinnedOptions')
    )
    if (!pinnedSection) {
      return
    }
    pinnedSection.root.style.display =
      settings.pinnedOptions.length > 0 ? 'block' : 'none'
  }

  private playNavRipple(button: HTMLButtonElement) {
    this.playRipple(button)
  }

  private playRipple(button: HTMLButtonElement) {
    if (!button.querySelector('.ripple')) {
      return
    }
    button.classList.remove('ripple-active')
    void button.offsetWidth
    button.classList.add('ripple-active')
    window.setTimeout(() => {
      button.classList.remove('ripple-active')
    }, 650)
  }

  private findSlot(name: string) {
    return this.form.querySelector(`slot[data-name="${name}"]`) as HTMLElement
  }

  private findSlotBlock(name: string) {
    return this.findSlot(name).parentElement as HTMLDivElement
  }

  private getCanonicalContainer(level1: OptionCategoryLevel1, level2: string) {
    return this.canonicalContainers.get(
      this.makeCanonicalKey(level1, level2)
    ) as HTMLDivElement
  }

  private makeCanonicalKey(level1: OptionCategoryLevel1, level2: string) {
    return `${level1}__${level2}`
  }

  private makeSectionKey(page: PageId, id: string) {
    return `${page}__${id}`
  }

  private getPersistedPageState(
    page: PersistedPageId,
    expandedCards = settings.expandedCards
  ) {
    return expandedCards[page]
  }
}

SettingsPanel.initShell()

export { SettingsPanel }
