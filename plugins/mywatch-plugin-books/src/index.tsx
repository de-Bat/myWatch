import type { MyWatchPlugin } from '@mywatch/plugin-sdk'
import { BooksCard } from './BooksCard'
import { AddBooksItemModal } from './AddBooksItemModal'
import { BooksSettingsPanel } from './BooksSettingsPanel'

const booksPlugin: MyWatchPlugin = {
  id: 'books',
  displayName: 'Books',
  listTypes: [
    {
      id: 'books',
      label: 'Books',
      CardComponent: BooksCard,
      AddItemModal: AddBooksItemModal,
    },
  ],
  settingsPanel: BooksSettingsPanel,
}

export default booksPlugin
