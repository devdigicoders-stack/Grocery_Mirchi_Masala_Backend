import xlsx from 'xlsx'

const workbook = xlsx.readFile('d:/Desktop/Groccery_shop/admin/Grocery_Master_Inventory-4 (1).xlsx')
const sheet = workbook.Sheets[workbook.SheetNames[0]]
const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 })
let currentCategory = 'General Grocery'
const names = new Set()
const duplicates = []
const itemsList = []

for (let i = 1; i < rows.length; i++) {
  const row = rows[i]
  if (!row || row.length === 0) continue
  if (typeof row[0] === 'string' && isNaN(Number(row[0])) && (row[1] === undefined || row[1] === null || row[1] === '')) {
    currentCategory = row[0].trim()
    continue
  }
  if (isNaN(Number(row[0]))) continue

  const itemName = String(row[1] || '').trim()
  const packSize = String(row[2] || '').trim()
  const specs = String(row[4] || '').trim()
  const rate = Number(row[5]) || 0
  const fullName = packSize ? `${itemName} (${packSize})` : itemName

  itemsList.push({
    sno: Number(row[0]),
    name: fullName,
    rawName: itemName,
    packSize,
    category: currentCategory,
    specs,
    rate
  })

  if (names.has(fullName.toLowerCase())) {
    duplicates.push(fullName)
  } else {
    names.add(fullName.toLowerCase())
  }
}

console.log('Total items parsed:', itemsList.length)
console.log('Total unique full names:', names.size)
console.log('Duplicates if any:', duplicates)
