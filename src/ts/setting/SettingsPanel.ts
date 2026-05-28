import { Config } from '../Config'
import { EVT } from '../EVT'
import { Utils } from '../utils/Utils'
import { optionConfigs } from './OptionConfigs'
import { OptionCategoryLevel1, settings, setSetting } from './Settings'
import { SettingsForm } from './SettingsForm'
import { SettingsPanelDownloadSummary } from './SettingsPanelDownloadSummary'
import {
  SettingsPanelLayout,
  SettingsPanelLayoutResult,
} from './SettingsPanelLayout'
import { SettingsPanelShell } from './SettingsPanelShell'
import { SearchRestorePage, SettingsPanelSearch } from './SettingsPanelSearch'
import { FoldableSection, PageId, PersistedPageId } from './SettingsPanelTypes'
import '../OpenSettingsPanel'

class SettingsPanel {
  constructor(form: SettingsForm) {
    SettingsPanelShell.init()
    this.form = form
    this.centerPanel = SettingsPanelShell.get()
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

  private activePage: PageId = 'home'
  private readonly optionElements = new Map<number, HTMLElement>()
  private canonicalContainers!: Map<string, HTMLDivElement>
  private pageEls!: Map<PageId, HTMLDivElement>
  private stickyEls!: Map<PageId, HTMLButtonElement>
  private navEls!: Map<PageId, HTMLButtonElement>
  private foldableSections!: Map<string, FoldableSection>
  private expandAllBtn!: HTMLButtonElement
  private homePinnedContent!: HTMLDivElement
  private downloadSummary!: SettingsPanelDownloadSummary
  private searchPanel!: SettingsPanelSearch

  private buildLayout() {
    const layout: SettingsPanelLayoutResult = new SettingsPanelLayout({
      form: this.form,
      centerPanel: this.centerPanel,
      optionElements: this.optionElements,
      getExpandedState: (section) => this.getExpandedState(section),
      applyExpandedState: (section, expanded) =>
        this.applyExpandedState(section, expanded),
      toggleSection: (section) => this.toggleSection(section),
      makeSectionKey: (page, id) => this.makeSectionKey(page, id),
      makeCanonicalKey: (level1, level2) =>
        this.makeCanonicalKey(level1, level2),
    }).build()

    this.pageEls = layout.pageEls
    this.stickyEls = layout.stickyEls
    this.navEls = layout.navEls
    this.foldableSections = layout.foldableSections
    this.canonicalContainers = layout.canonicalContainers
    this.homePinnedContent = layout.homePinnedContent
    this.expandAllBtn = this.centerPanel.querySelector(
      '#settingsPanelToggleExpand'
    ) as HTMLButtonElement
    this.searchPanel = new SettingsPanelSearch({
      root: layout.searchRoot,
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

  private bindEvents() {
    this.stickyEls.forEach((sticky) => {
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

SettingsPanelShell.init()

export { SettingsPanel }
