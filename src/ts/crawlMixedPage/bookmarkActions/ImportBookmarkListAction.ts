type ActionHandler = () => void | Promise<void>

class ImportBookmarkListAction {
  constructor(btn: HTMLButtonElement, handler: ActionHandler) {
    btn.addEventListener('click', () => {
      void handler()
    })
  }
}

export { ImportBookmarkListAction }
