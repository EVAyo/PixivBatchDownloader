import { EVT } from '../../EVT'
import { lang } from '../../Language'
import { log } from '../../Log'
import { toast } from '../../Toast'
import { unBookmarkWorks } from '../../UnBookmarkWorks'
import { Bookmark404ActionBase } from './Bookmark404ActionBase'

class UnBookmarkAll404WorksAction extends Bookmark404ActionBase {
  constructor(btn: HTMLButtonElement) {
    super()

    btn.addEventListener('click', () => {
      const title = lang.transl('_取消收藏所有已被删除的作品')
      log.warning(title)
      toast.warning(title, {
        position: 'topCenter',
      })
      EVT.fire('closeCenterPanel')

      void this.run({
        crawlNumber: -1,
        resetOffset: true,
        slowCrawl: true,
        collectWork: (workData) => {
          if (Number.parseInt(workData.userId) !== 0) {
            return null
          }
          return this.createBookmarkData(workData)
        },
        onCollected: async (bookmarkDataList) => {
          this.exportBookmark404Ids(bookmarkDataList)
          await unBookmarkWorks.start(bookmarkDataList)
        },
      })
    })
  }
}

export { UnBookmarkAll404WorksAction }
