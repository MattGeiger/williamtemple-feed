# Data Management

Data Management imports external records into FEED without mixing them into
the Food Item catalog. The first supported source is the standardized Oregon
Food Bank completed-orders CSV.

## Import Oregon Food Bank Data

The OFB Order CSV Exporter Chrome Extension is required because Primarius does
not provide FEED's unified CSV directly.

If the extension is not installed yet:

1. Open **Information → Data Management** and select **Import OFB Data**.
2. Select the **OFB Order CSV Exporter Chrome Extension and installation guide**
   link.
3. Unzip the downloaded package and open the included PDF instructions.
4. In Chrome, open `chrome://extensions`, turn on **Developer mode**, and select
   **Load unpacked**.
5. Choose the package's `OFB-Order-CSV-Exporter-v2.0.0` folder. Keep that folder
   in place after installation.

To import data:

1. Open **Order History** in Primarius and reload the page if the extension was
   just installed.
2. Choose the Start date and End date, then select **Export unified CSV**.
3. Keep Primarius open until the exporter reports success and downloads the
   CSV.
4. Return to **Information → Data Management → Import OFB Data**.
5. Drop the CSV into the import area, or choose it from your device.
6. Select **Import Data** and review the short result summary and any
   data-quality notes.

FEED reads the CSV, stores normalized procurement observations, and discards
the uploaded file. An overlapping export is safe: orders FEED already has are
skipped, while corrected source orders become a new revision.

Import warnings do not create a correction queue. A warning means FEED found a
source value it could preserve and reconcile safely, such as a displayed price
total that differs from quantity multiplied by unit price. A structural error
stops the import and tells you to export the range again.

## Review Import History

The Import History table shows:

- the covered receiving dates;
- source-row and source-order counts;
- data-quality warning counts;
- when each import was completed;
- whether an import is active or rolled back.

Open the row action menu and choose **View Details** to inspect source-order
revisions and warnings. The table supports the same filtering, columns,
pagination, row selection, and bulk actions used by other FEED management
pages.

## Roll Back Or Restore An Import

Use **Rollback** when an import contains unwanted or incorrect source data.
Rollback does not erase the audit trail. It removes that import's revisions
from Analytics and restores the preceding active revision of each affected
source order when one exists.

Use **Restore Import** to make a rolled-back import eligible again. FEED always
uses the newest active revision for a source order.

Rollback and restore are procurement-only actions. They do not change Food
Items, availability, limits, translations, or Shopping Lists.

## Keep Procurement Current

FEED flags procurement data when the latest active receiving date is more than
30 calendar days old. Import a current completed-orders export before relying
on recent trends. The reminder is a freshness prompt, not a score or criticism
of staff work.

## What To Read Next

- To understand the resulting visualizations, read [Inventory Analytics](04-inventory-reports.md#read-procurement-analytics).
- To manage Food Items and availability, read [Inventory](03-inventory.md).

## The Analytics and Database tabs

Data Management has two tabs. **Analytics** opens by default and holds
everything on this page — coverage, data rules, importing, and the import
history. **Database** holds backup actions and appears for administrators only.

## Downloading a backup

Administrators can save a copy of the pantry's data from **Database →
Download Backup**.

It contains categories and food items with their limits, every saved
translation, shopping list templates and saved components, imported procurement
history and data rules, and your settings.

It deliberately leaves out AI provider keys, encryption keys, sign-in codes, the
staff list, and uploaded documents. That means it **cannot restore FEED on its
own** — it is a copy of your working data, not of the whole system. Ask whoever
maintains your server to keep full server backups as well.

Keep the file somewhere private. It still holds your organization's data.

The same tab shows what FEED is currently holding: record counts by kind, the
size of the database, and when the last backup was taken.

**Restoring from a backup is not available yet.** The button is there and will
say so if you press it.
