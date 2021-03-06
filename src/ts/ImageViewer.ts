// 图片查看器
/// <reference path = "./ImageViewer.d.ts" />
import { API } from './API'
import { EVT } from './EVT'
import { lang } from './Lang'
import { theme } from './Theme'
import { loading } from './Loading'
import { states } from './store/States'
import { toast } from './Toast'
import { Tools } from './Tools'
import { ArtworkData } from './crawl/CrawlResult'
import { Bookmark } from './Bookmark'

// 所有参数
interface Config {
  // 作品 id
  // 默认从 url 中获取作品 id，但要考虑到获取 id 失败的情况
  workId: string
  // 是否显示缩略图列表
  // 默认为 false，不会把缩略图列表添加到页面上
  // 如果需要显示缩略图列表供用户查看，则应为 true
  showImageList: boolean
  // 图片列表容器的 id
  // 默认为空字符串
  // 对于图片查看器来说没有任何作用。如果需要获取图片列表容器，或者使用 css 控制样式，可以传入 id 作为标记
  imageListId: string
  // 图片列表要插入到的父元素的选择器
  // 默认为空字符串
  // showImageList 为 false 时可以省略，为 true 时必需
  insertTarget: string
  // 插入到父元素的什么位置
  // 默认为 beforeend
  // showImageList 为 false 时可以省略，为 true 时必需
  insertPostion: InsertPosition
  // 图片最少有多少张时 >= 才会启用查看器
  // 默认为 2
  imageNumber: number
  // 查看大图时，显示哪种尺寸的图片
  // 默认为 original
  imageSize: 'original' | 'regular' | 'small'
  // 是否显示下载按钮
  // 默认为 true
  showDownloadBtn: boolean
  // 是否显示收藏按钮
  // 默认为 true
  showBookmarkBtn: boolean
  // 初始化之后，直接启动查看器，无需用户点击缩略图
  // 默认为 false
  // showImageList 为 false 时建议 autoStart 为 true
  autoStart: boolean
  // 获取作品数据期间，是否显示 loading 动画
  // 默认为 false
  showLoading: boolean
}

// 可选参数
interface ConfigOptional {
  workId?: string
  showImageList?: boolean
  imageListId?: string
  insertTarget?: string
  insertPostion?: InsertPosition
  imageNumber?: number
  imageSize?: 'original' | 'regular' | 'small'
  showDownloadBtn?: boolean
  showBookmarkBtn?: boolean
  autoStart?: boolean
  showLoading?: boolean
}

// 对 Viewer 进行修改以供下载器使用
// 原版是接收页面上已存在的缩略图列表，但在下载器里它需要从作品 id 获取数据，生成缩略图列表
class ImageViewer {
  constructor(cfg: ConfigOptional) {
    this.cfg = Object.assign(this.cfg, cfg)
    this.init()
  }

  private myViewer!: Viewer // 查看器
  private viewerWarpper: HTMLDivElement = document.createElement('div') // 图片列表的容器
  private viewerUl: HTMLUListElement = document.createElement('ul') // 图片列表的 ul 元素

  private show = false // 当前查看器实例是否处于显示状态

  // 图片查看器显示时，保存页面滚动位置
  private scrollX = 0
  private scrollY = 0

  // 图片查看器初始化时，会获取作品数据，保存到这个成员
  private workData: ArtworkData | undefined

  // 默认配置
  private cfg: Config = {
    workId: Tools.getIllustId(),
    showImageList: false,
    imageListId: '',
    insertTarget: '',
    insertPostion: 'beforeend',
    imageNumber: 2,
    imageSize: 'original',
    showDownloadBtn: true,
    showBookmarkBtn: true,
    autoStart: false,
    showLoading: false,
  }

  private readonly viewerWarpperFlag = 'viewerWarpperFlag'
  private readonly addBtnClass = 'viewer-add-btn'

  private init() {
    // 当创建新的查看器实例时，删除旧的查看器元素。其实不删除也没有问题，但是查看器每初始化一次都会创建全新的对象，所以旧的对象没必要保留。

    // 删除之前创建的图片列表，否则旧的图片列表依然存在
    const oldViewerWarpper = document.querySelector(
      '.' + this.viewerWarpperFlag
    )
    oldViewerWarpper && oldViewerWarpper.remove()

    // 删除旧的查看器的 DOM 节点
    const oldViewerContainer = document.querySelector('.viewer-container')
    oldViewerContainer && oldViewerContainer.remove()

    this.createImageList()

    this.bindEvents()
  }

  // 如果多次初始化查看器，这些事件会被多次绑定。但是因为回调函数内部判断了查看器实例，所以不会有问题
  private bindEvents() {
    // 按 F 进入/退出全屏模式
    document.addEventListener('keydown', (event) => {
      if (event.code === 'KeyF') {
        if (this.show) {
          this.isFullscreen()
            ? document.exitFullscreen()
            : this.enterFullScreenMode()
        }
      }
    })

    // 按 Alt + B 收藏当前作品
    // 因为 Pixiv 会在按下 B 键时收藏当前作品，所以下载器不能使用 B 键。尝试阻止 Pixiv 的事件但是没有成功
    document.addEventListener('keydown', (event) => {
      if (event.altKey && event.code === 'KeyB') {
        if (this.show) {
          this.addBookmark()
        }
      }
    })

    // 按 D 下载当前作品
    document.addEventListener('keydown', (event) => {
      if (event.code === 'KeyD') {
        if (this.show) {
          this.download()
        }
      }
    })

    // 监听左右方向键，防止在看图时，左右方向键导致 Pixiv 切换作品
    window.addEventListener(
      'keydown',
      (event) => {
        if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
          if (this.show) {
            // 阻止事件冒泡
            event.stopPropagation()
            // 控制切换到上一张或者下一张
            // true 表示启用循环切换
            event.code === 'ArrowLeft'
              ? this.myViewer.prev(true)
              : this.myViewer.next(true)
          }
        }
      },
      true
    )
    ;[
      'fullscreenchange',
      'webkitfullscreenchange',
      'mozfullscreenchange',
    ].forEach((arg) => {
      // 检测全屏状态变化，目前有兼容性问题（这里也相当于绑定了按 esc 退出的事件）
      document.addEventListener(arg, () => {
        // 退出全屏
        if (this.myViewer && !this.isFullscreen()) {
          this.toggleBottomBtns(true)
        }
      })
    })
  }

  // 创建缩略图列表
  private async createImageList() {
    if (this.cfg.showImageList) {
      // 如果要显示缩略图列表，则等待要插入的容器元素生成
      if (!document.querySelector(this.cfg.insertTarget)) {
        window.setTimeout(() => {
          this.createImageList()
        }, 300)
        return
      }
    }

    let useBigURL = '' // 查看大图时的第一张图片的 url

    // 查看器图片列表元素的结构： div > ul > li > img
    // 创建图片列表的容器
    this.viewerWarpper = document.createElement('div')
    this.viewerWarpper.classList.add(this.viewerWarpperFlag)
    this.viewerUl = document.createElement('ul')
    this.viewerWarpper.appendChild(this.viewerUl)
    this.viewerWarpper.style.display = 'none'

    if (this.cfg.imageListId) {
      this.viewerWarpper.id = this.cfg.imageListId
    }

    if (this.cfg.showLoading) {
      loading.show = true
    }

    // 获取作品数据，生成缩略图列表
    this.workData = await API.getArtworkData(this.cfg.workId)
    const body = this.workData.body
    // 处理插画、漫画、动图作品，不处理其他类型的作品
    if (
      body.illustType === 0 ||
      body.illustType === 1 ||
      body.illustType === 2
    ) {
      // 如果图片数量达到指定值，则会创建创建缩略图，启用查看器
      if (body.pageCount >= this.cfg.imageNumber) {
        // 配置大图 url
        useBigURL = body.urls[this.cfg.imageSize] || body.urls.original

        // 生成缩略图列表
        let html = []
        for (let index = 0; index < body.pageCount; index++) {
          // 使用 thumb url 的话，p0 之后的图片经常没有对应的文件，导致缩略图因为 404 无法显示。根据 issues/140 使用另一套 url 作为缩略图 url，不会产生 404。前后对比示例：
          // https://i.pximg.net/c/250x250_80_a2/custom-thumb/img/2021/03/03/06/29/53/88179809_p1_custom1200.jpg
          // https://i.pximg.net/c/128x128/img-master/img/2021/03/03/06/29/53/88179809_p1_square1200.jpg
          const str = `<li><img src="${Tools.convertArtworkThumbURL(
            body.urls.thumb,
            index
          )}" data-src="${useBigURL.replace('p0', 'p' + index)}"></li>`
          html.push(str)
        }
        this.viewerUl.innerHTML = html.join('')
      } else {
        return
      }
    } else {
      return
    }

    if (this.cfg.showLoading) {
      loading.show = false
    }

    if (this.cfg.showImageList) {
      // 把缩略图列表添加到页面上
      theme.register(this.viewerWarpper)

      this.viewerWarpper.style.display = 'block'

      const target = document.querySelector(this.cfg.insertTarget)
      if (target) {
        target.insertAdjacentElement('beforebegin', this.viewerWarpper)
      }
    }

    this.configureViewer(body.pageCount, useBigURL)
  }

  // 配置图片查看器
  private async configureViewer(pageCount: number, firstBigImgURL: string) {
    // 图片查看器显示之后
    this.viewerUl.addEventListener('shown', () => {
      this.show = true

      this.scrollX = window.scrollX
      this.scrollY = window.scrollY

      if (this.cfg.showDownloadBtn) {
        this.addDownloadBtn()
      }

      if (this.cfg.showBookmarkBtn) {
        this.addBookmarkBtn()
      }

      // 显示相关元素
      this.toggleBottomBtns(true)

      // 点击 1：1 按钮时，全屏查看
      const oneToOne = document.querySelector('.viewer-one-to-one')
      if (oneToOne) {
        oneToOne.setAttribute('title', lang.transl('_全屏查看') + ' (F)')
        oneToOne.addEventListener(
          'click',
          (ev) => {
            // 阻止冒泡，否则放大过程中会多一次闪烁（推测可能是这个按钮原有的事件导致的，停止冒泡之后就好了）
            ev.stopPropagation()
            this.enterFullScreenMode()
          },
          true
        )
      }
    })

    // 退出图片查看器时（可能尚未完全退出）
    this.viewerUl.addEventListener('hide', () => {
      this.show = false
      // 如果查看图片时进入了全屏模式，退出全屏后页面就会滚动到最顶端。在这里让页面滚动到查看图片之前的位置
      window.scrollTo(this.scrollX, this.scrollY)
    })

    // 查看每一张图片时，如果处于全屏模式，就把图片缩放到 100%
    // viewed 事件是图片加载完成时触发的
    this.viewerUl.addEventListener('viewed', () => {
      if (this.isFullscreen()) {
        this.myViewer.zoomTo(1)
      }
    })

    // 隐藏查看器时，如果还处于全屏，则退出全屏
    this.viewerUl.addEventListener('hidden', () => {
      if (this.isFullscreen()) {
        document.exitFullscreen()
      }
    })

    // 销毁旧的看图组件
    // 目前不会复用查看器，所以不用销毁
    // if (this.myViewer) {
    //   this.myViewer.destroy()
    // }

    // 因为选项里的 size 是枚举类型，所以在这里也要定义一个枚举
    enum ToolbarButtonSize {
      Small = 'small',
      Medium = 'medium',
      Large = 'large',
    }

    // 配置新的看图组件
    const handleCenter = this.handleCenter.bind(this)

    this.myViewer = new Viewer(this.viewerUl, {
      toolbar: {
        zoomIn: 0,
        zoomOut: 0,
        oneToOne: 1,
        reset: 0,
        prev: 1,
        play: {
          show: 0,
          size: ToolbarButtonSize.Large,
        },
        next: 1,
        rotateLeft: 0,
        rotateRight: 0,
        flipHorizontal: 0,
        flipVertical: 0,
      },

      url(image: HTMLImageElement) {
        return image.dataset.src!
      },

      viewed(ev) {
        handleCenter()
        // 当图片显示完成（加载完成）后，预加载下一张图片
        let index = ev.detail.index

        if (index < pageCount - 1) {
          index++
        }

        const nextImg = firstBigImgURL.replace('p0', 'p' + index)
        const img = new Image()
        img.src = nextImg
      },

      // 取消一些动画，比如切换图片时，图片从小变大出现的动画
      transition: false,
      keyboard: true,
      // 不显示 title（图片名和宽高信息）
      title: false,
      // 不显示缩放比例
      tooltip: false,
    })

    // 预加载第一张图片
    const img = new Image()
    img.src = firstBigImgURL

    if (this.cfg.autoStart) {
      // 自动显示
      this.myViewer.show()
    }
  }

  // 进入全屏模式
  private enterFullScreenMode() {
    this.toggleBottomBtns(false)

    // 请求全屏模式
    document.body.requestFullscreen().then(() => {
      // 把图片按 100% 比例显示，需要延迟执行
      window.setTimeout(() => {
        // 放大图片
        this.myViewer.zoomTo(1)

        this.handleCenter()
        // 延迟时间不能设置为 0，也不能设置的太小，否则存在问题：
        // 在打开调试工具时（即网页宽度被减少），如果延迟时间太小，按 F 进入全屏之后实际上不会放大图片（但是按 1:1 按钮却可以放大，原因不清楚）
      }, 150)
    })
  }

  // 处理居中问题
  private handleCenter() {
    // 当图片高度大于网页视口高度时，在垂直方向上，图片查看器默认是居中显示
    // 当图片类型为漫画时，改为显示顶部，这样便于查看漫画
    if (this.workData?.body.illustType === 1) {
      // 判断图片的高度是否超出网页视图高度。使用图片的显示高度，而不是自然高度
      const img = this.myViewer.image as HTMLImageElement
      const windowHeight = window.innerHeight
      if (img.height <= windowHeight) {
        return
      }
      // 如果图片高度大于视口高度，将其移动以达到显示顶部的效果
      const hiddenHeight = img.height / 2 - windowHeight / 2
      this.myViewer.move(0, hiddenHeight)
    }
  }

  /**在图片查看器的工具栏里添加按钮
   *
   * 元素必须具有 id 属性，用于区分
   */
  private addBtn(btn: HTMLElement) {
    // 最后的查看器元素就是最新添加的查看器
    const allContainer = document.querySelectorAll('.viewer-container')
    const last = allContainer[allContainer.length - 1]

    const test = last.querySelector('#' + btn.id)
    if (test) {
      return
    }

    const one2one = last.querySelector('.viewer-one-to-one')
    if (one2one) {
      return one2one.insertAdjacentElement('afterend', btn) as HTMLElement
    } else {
      console.error('Add btn failed')
    }
  }

  // 在图片查看器里添加下载按钮
  private addDownloadBtn() {
    const li = document.createElement('li')
    li.setAttribute('role', 'button')
    li.setAttribute('title', lang.transl('_下载') + ' (D)')
    li.classList.add(this.addBtnClass)
    li.textContent = '↓'
    li.id = 'imageViewerDownloadBtn'

    this.addBtn(li)

    li.addEventListener('click', () => {
      this.download()
    })
  }

  // 在图片查看器里添加收藏按钮
  private addBookmarkBtn() {
    const li = document.createElement('li')
    li.setAttribute('role', 'button')
    li.setAttribute('title', lang.transl('_收藏') + ' (Alt + B)')
    li.classList.add(this.addBtnClass)
    li.style.fontSize = '14px'
    li.textContent = '❤'
    li.id = 'imageViewerBookmarkBtn'
    this.addBtn(li)

    li.addEventListener('click', async () => {
      this.addBookmark()
    })
  }

  private async addBookmark() {
    // 显示提示
    toast.show(lang.transl('_收藏'), {
      bgColor: '#333',
      position: 'mouse',
    })

    await Bookmark.add(
      this.cfg.workId,
      'illusts',
      Tools.extractTags(this.workData!)
    )
    toast.success(lang.transl('_已收藏'))
  }

  // 下载当前查看的作品
  private download() {
    // 因为 downloadFromViewer 状态会影响后续下载行为，所以必须先判断 busy 状态
    if (states.busy) {
      toast.error(lang.transl('_当前任务尚未完成'))
      return
    }

    states.downloadFromViewer = true

    // 发送要下载的作品 id
    EVT.fire('crawlIdList', [
      {
        id: this.cfg.workId,
        type: 'unknown',
      },
    ])

    // 显示提示
    toast.show(lang.transl('_已发送下载请求'), {
      bgColor: '#333',
      position: 'mouse',
    })
  }

  // 判断是否处于全屏状态
  private isFullscreen() {
    return !!document.fullscreenElement
  }

  // 控制查看器底部的一些元素的显示和隐藏
  private toggleBottomBtns(show: boolean) {
    document
      .querySelector('.viewer-container')!
      .classList.remove('black-background')
    // 显示底部隐藏的元素
    const close = document.querySelector('.viewer-close') as HTMLDivElement
    const oneToOne = document.querySelector(
      '.viewer-one-to-one'
    ) as HTMLDivElement
    const navbar = document.querySelector('.viewer-navbar') as HTMLDivElement
    const addBtns = document.querySelectorAll(
      '.' + this.addBtnClass
    ) as NodeListOf<HTMLElement>
    for (const element of [close, oneToOne, navbar, ...addBtns]) {
      if (element) {
        element.style.display = show ? 'block' : 'none'
      }
    }
  }
}

export { ImageViewer }
