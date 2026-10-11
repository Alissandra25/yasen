# Business Requirements — Yasen inventory & sales app

A plain-language description of how the system should work — for review, approval and feedback. Technical details are in a separate document: [technical.md](technical.md).

## 1. What the system is

A web application for a shop: tracking products in the shop and warehouse, recording daily sales, automatic restock lists, and sales and profitability analytics.

## 2. Who uses it

- **Owner** — sees everything: products, stock, sales, analytics; manages users.
- **Seller** — enters sales and sees stock, but not analytics or profitability.

(At launch only the owner works; the seller role is reserved for the future.)

## 3. Products and stock

- For each product: name, SKU, category, purchase price, sale price.
- Stock is tracked separately for the shop and the warehouse.
- Products can be edited and archived.
- **Categories and subcategories, display order:** the owner sets the order of categories (and of subcategories within each category) in the settings, simply by dragging them with the mouse. Products appear in the sales table in exactly this order when all categories are shown at once.
- **Unit of measure:** each product is counted in one unit — a piece or a pack. The system doesn't care whether a product is packaged: only the final quantity in the warehouse and shop matters. The key is that a product is always measured the same way — both when it arrives and when it is sold.
- **Upload from a file (CSV):** products and suppliers can be uploaded in bulk from a file rather than entered one by one. The system compares by name to avoid duplicates. If it finds ones that already exist, it shows them in a separate list where for each you can decide: merge, overwrite or keep the existing one (or one action for all at once).
  - *Note:* you don't have to prepare the file yourselves. If records are currently kept in notebooks, you can simply photograph the pages with product lists and stock — we'll prepare the upload file from those photos.
- **Archive suggestions:** reference lists have a filter that suggests what can be archived. Products — those with no stock and no movement for a long time (one month by default); suppliers — those with no deliveries for a long time (three months by default). Both periods are configurable. You can select all or some and archive them together.
- **"Worth reviewing" list:** when a product or supplier is created quickly while receiving goods (e.g. a supplier with just a name), it goes into a separate list — a reminder to come back later and fill in the details (contacts, minimum stock, etc.). Contacts are optional — you can keep them in your phone. After review the record is confirmed and leaves the list; you can confirm several at once without opening each.

## 3a. Receiving goods from a supplier

- A delivery is recorded as **a single document**: choose the supplier and where the goods are going (usually the warehouse).
- **Each item can go to its own place:** part of a delivery can go straight to the shop and the rest to the warehouse — no separate transfer needed. You can select several items at once and send them all to one place. One product can also be split: e.g. 10 to the warehouse and 5 to the shop, in the same delivery.
- For each item the owner enters the quantity and **how much they paid**. The sale price can be entered right away or left for later — it is optional.
- After posting, stock increases and prices are saved in history (for correct profitability).
- A new product can be created directly from the delivery document.
- Suppliers are kept in a separate list (name, contacts), so you can see who you bought what from and at what price.
- If the supplier is new, its name can be typed in right during receiving — it will automatically appear in the list. No need to go to a separate table and fill in contacts — the name is enough, the rest later.
- **Main supplier of a product:** by default, the supplier it was last delivered by; it can be changed.
- **Supplier tracking is optional.** If the shop doesn't want to keep suppliers at all, this can be turned off in settings: the supplier field, the supplier list and all supplier filters disappear. Nothing already entered is lost — turning it back on brings everything back. Returning defective goods to a supplier still works, just without naming the supplier. By default tracking is on.

## 4. Sales

- A sale records the product, quantity, date and who sold it.
- Stock decreases automatically.
- **Sales entered for past days** use the prices that were in effect on that day, not today's prices, so profit stays correct.
- **A sale is never blocked, even if there's no stock.** If the product is physically there, it can be sold. Stock may then become negative, and such items are highlighted as a signal that the records need reconciling.
- **Payment method:** each sale records whether it was cash or card. This enables cash reconciliation at the end of the day (how much should be in cash, how much went by card) and a revenue breakdown in analytics. The list of methods can be extended.

## 4a. How sales are entered (at launch)

Initially sales are entered by **the owner** — for example, in the evening they transfer into the app what sellers wrote in notebooks during the day. (Real-time entry by sellers is for the future.)

- It looks like a **table**: products in rows, days in columns, and in each cell — how many of that product were sold that day.
- The product list can be filtered by category to find things quickly.
- When no filter is selected and all products are shown, they are grouped by category in the order the owner configured (see section 3). Within a category, products can be sorted in the usual ways: by name A to Z or Z to A, by date added, by SKU.
- The owner enters or edits the quantity for a specific day directly in the cell.
- Stock is shown alongside: how much there was at the start of the period and how much is left now.
- **Cash/card split — optional (setting):** you can turn on a mode where each cell splits in two — how many of the product were sold for cash and how many by card (e.g. 50 cash, 5 card). If you don't want the hassle, keep one cell and enter however is convenient. The split toggle is right above the table, so it can be switched on and off at any time, depending on whether there's time today to break it down.
- **Working without internet:** this table can be filled in even without a connection — data is saved on the device and sent to the database automatically as soon as the internet is back. Nothing is lost or duplicated. Offline works only for entering sales; editing products and prices is online only.

## 5. Stock adjustments (stocktake)

- When the actual quantity doesn't match the system, stock can be corrected manually.
- A **reason** is given (breakage, shortage, mis-sort, etc.).
- Every correction is saved in history: who, when, from what to what, and why.

**Monthly stocktake (full count):**

- A separate mode where once a month (or whenever convenient) actual stock in the warehouse is recounted.
- The owner sees a list of products with system stock and enters the actual quantity next to each.
- The system highlights where it doesn't match and shows the difference. After posting, stock is aligned to actual, and all discrepancies go into history.
- The result is a **stocktake report** (system / counted / difference), exportable to PDF and saved so you can compare month to month.

**Correcting mistakes in documents:**

- A delivery, transfer or other document can be corrected after posting. Both versions — before and after — are kept in the history.
- Stock changes only by the difference (e.g. 12 corrected to 10 removes 2).
- If a purchase price was entered wrongly, profit on items already sold is recalculated.
- **Closed periods don't change.** A month closes automatically 5 days after it ends (the number of days is configurable), and a stocktake closes everything before it. Mistakes in a closed period are fixed by a regular stock correction with a reason, so printed reports and signed stocktake reports always stay true.
- The owner can reopen a closed period for a serious mistake, giving a reason; it closes again automatically after 24 hours.

## 6. Moving goods between locations

- Goods can be moved from the warehouse to the shop (and between any locations) with **a single document**, not one product at a time.
- You see a list of products available at the location with a category filter; tick the items you need and enter quantities.
- One click — and stock is updated for all items together.
- You can't move more than actually exists.

## 7. Customer returns

Depends on the reason:

- **Product is resellable (wrong size, changed mind):** it goes back into stock and is available for sale again.
- **Product is defective:** it doesn't go back on sale. Two options:
  - **For supplier replacement** — the product is set aside for the supplier to replace or compensate.
  - **Write-off** — the product is written off as a loss.
- In any case the sale is reversed: revenue and profit for that item decrease.
- **Refund and the till:** when a return is recorded, the money is automatically deducted from the day's revenue. The owner only specifies **how the money was given back** — cash from the till or a transfer to a card — and the reconciliation is reduced in that column. How the customer originally paid doesn't matter and isn't known.

## 8. Supplier replacement of defective goods

When the supplier responds to a defect, the item is closed in one of three ways:

- **Same product** — a new unit of the same product comes back to the warehouse.
- **Substitute** — a different product comes into the warehouse instead.
- **Money** — no product comes back; the business receives cash compensation.

The whole history stays visible: sold → defect found → sent to supplier → how it was resolved.

## 9. Restock lists

The system suggests what needs restocking, based on flexible rules:

- **By minimum stock** — when less than the set minimum is left.
- **By sales activity** — when a product is selling well: it goes on the list if, since the start of the month, half or more has been sold of what was in stock at the start of the month plus deliveries since then. This signals that the product is moving and it's time to think about ordering.
- Rules can be turned on, and new ones added later.
- **How it works:** when you open the restock page, the system suggests a list based on the rules. You can change quantities, add products, remove rows — and save it. Several saved lists can exist at once; each can be printed or exported.
- The need is calculated for the whole business (all locations together). Topping up a specific shop is done with a transfer.
- A saved list has a status: draft → ordered → done. It becomes done automatically when everything arrives, or can be marked manually. Old lists are archived, not deleted.
- If a product is already in an open list, the new suggestion marks it 'already in list from…' so you don't order twice by accident.
- Next to the menu item there is a counter of how many products need restocking.
- **By supplier:** a list is split by supplier, and each part can be exported as an order to that supplier.
- When a product is created, both rules are turned on automatically. The threshold (default 50%) and the minimum can be changed — for the whole business or for an individual product.

## 10. Analytics (owner only)

- Top products by sales for a period.
- Margin and profit: revenue minus purchase cost.
- Revenue and profit per day / week / month.
- **Cash reconciliation:** for a day or period you can see how much revenue was cash, how much card, and the total. (Comparison with actual cash in the till — in the future.)
- **Discounts at launch:** if some sales went for less (e.g. a discount for military personnel), the owner can enter an adjustment for the day — how much lower actual revenue was — so the till balances. Full discounts by customer type — once real-time POS is in place.
- **Discrepancy analytics** (based on correction and stocktake history): which items most often don't match and why (breakage, shortage, mis-sort), where the biggest monetary losses are, and whether shortages are growing month to month.

## 10a. Exporting documents and reports

Data can be exported out of the system:

- **Documents for printing — PDF:** stocktake report, transfer document, delivery document — to print, sign or hand over.
- **Reports for analysis — Excel and PDF:** sales, revenue, profit, discrepancies — so the owner can do their own calculations.
- Any report, large or small, can be exported to either PDF or Excel — your choice.

**Monthly report of all movement:**
One place to see everything for the month: what arrived, what was sold, what was returned and how (resellable, defective, replaced with the same / substitute / money), stocktakes and totals.

- You can take one large summary report or smaller individual ones (sales only, returns only, etc.) — whichever is convenient.

## 11. Languages

The interface is multilingual: English, Ukrainian and Russian at launch, with the option to add others. The user chooses the language and the choice is saved.

## 11a. Look and feel

- The app uses the shop's brand colours, as on its signage: light green as the main colour, orange as the accent. Colours are configurable, so another shop can set its own.
- Warnings and errors (negative stock, discrepancies) are always highlighted in red so they don't get lost among the brand colours.
- A logo can be uploaded — it appears in the app header and on printable documents (a PNG or JPG image).
- **Chosen logo:** the ash leaf (green leaflets, orange top leaflet) with the name 'Ясен' and the tagline 'господарські товари'. The same leaf is used as the browser tab icon and the phone home-screen icon.
- There is a light and a dark theme: each user chooses, or leaves it to follow their phone or computer settings.

## 12. VAT

VAT can be turned on if needed (off by default), with the rate in settings. The current shop doesn't need it, but it is provided for other shops in the future.

## 12a. Time zone, currency, backups

- **Time zone:** set in the shop's settings (Kyiv by default). Days and months are always counted by the shop's time, even if the owner is on holiday in another time zone.
- **Currency:** hryvnia by default; another shop can set its own currency.
- **Backups:** the data is backed up automatically every day, plus a separate encrypted copy is kept outside the hosting, so nothing is lost even if something happens to the hosting account.

## 13. Questions for the owner

- **Units and packs:** does it ever happen that a product arrives by the box but is sold by the piece (or vice versa)? Our assumption is that each product is counted in one unit, and even if a box arrives with an unknown quantity, it is still counted on receipt to record the delivery. If that's the case, nothing needs to be added; if there are exceptions, please let us know.

## 14. What comes first

The system is built in stages, so you can start using it as early as possible:

1. **First version:** products and categories (with upload from a file), deliveries, the sales table with cash/card, daily cash totals, stock levels, corrections and moving goods between locations.
2. **Working without internet** in the sales table.
3. **Control:** monthly stocktake, customer returns, restock lists, correcting mistakes in documents, printing and exports, the monthly report.
4. **Analytics and settings:** charts and profit, brand colours and logo, other convenience features.

Until returns arrive in step 3, a return can be recorded as a regular stock correction with a reason.
