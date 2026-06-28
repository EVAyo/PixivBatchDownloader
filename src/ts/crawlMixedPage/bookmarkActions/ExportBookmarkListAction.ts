type ActionHandler = () => void | Promise<void>

class ExportBookmarkListAction {
  constructor(btn: HTMLButtonElement, handler: ActionHandler) {
    btn.addEventListener('click', () => {
      void handler()
    })
  }
}

export { ExportBookmarkListAction }
