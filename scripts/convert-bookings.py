# Converts "Crystal planner volledig.xls" (old booking-system export) into
# activities.csv ready to seed the activities table.
# Run: python3 scripts/convert-bookings.py   (needs: pip install xlrd)
#
# Judgment calls, verified against the source data:
# - Every unique row appears an even number of times (export doubled everything),
#   so multiplicity is halved instead of fully deduped: a x4 row = 2 real bookings.
# - Apartment number comes from the email via apartment-emails.csv (authoritative).
#   Rows with unknown emails, or where the address's B-number contradicts the
#   email's apartment, are skipped and reported — we can't vouch for them.
# - block: slot start before 12:30 = morning, else afternoon (PROJECT.md blocks).
# - type: 'other' — these are booked activities, not confirmed moves; original
#   calendar name + slot kept in note.
import csv
import re
from collections import Counter

import xlrd

XLS = 'Crystal planner volledig.xls'
OUT = 'activities.csv'

email_to_apt = {}
with open('apartment-emails.csv') as f:
    for row in csv.DictReader(f):
        for e in row['emails'].split(','):
            email_to_apt[e.strip().lower()] = int(row['apartment'])
valid_apts = {int(r['apartment']) for r in csv.DictReader(open('crystal-apartments-by-floor.csv'))}

sheet = xlrd.open_workbook(XLS).sheets()[0]
raw = [tuple(str(sheet.cell_value(r, c)).strip() for c in range(5)) for r in range(1, sheet.nrows)]

counts = Counter(raw)
odd = [r for r, n in counts.items() if n % 2]
assert not odd, f'expected every row doubled by the export, found odd counts: {odd}'
rows = [r for r, n in counts.items() for _ in range(n // 2)]


def apt_from_address(addr):
    m = re.search(r'[Bb][\s-]*(\d+)', addr)
    n = int(m.group(1)) if m else None
    return n if n in valid_apts else None


skipped, out = [], []
for addr, email, name, date, slot in rows:
    by_email = email_to_apt.get(email.lower())
    by_addr = apt_from_address(addr)
    if by_email is None:
        skipped.append(('unknown email', addr, email, date, slot))
        continue
    if by_addr is not None and by_addr != by_email:
        skipped.append((f'address says {by_addr}, email owns {by_email}', addr, email, date, slot))
        continue

    d, m, y = date.split('/')
    start_h, start_m = map(int, slot.split(' - ')[0].split(':'))
    out.append({
        'apartment_number': by_email,
        'type': 'other',
        'date': f'{y}-{m}-{d}',
        'block': 'morning' if (start_h, start_m) < (12, 30) else 'afternoon',
        'note': f'Import: {name}, {slot}',
    })

out.sort(key=lambda r: (r['date'], r['apartment_number']))
with open(OUT, 'w', newline='') as f:
    w = csv.DictWriter(f, fieldnames=['apartment_number', 'type', 'date', 'block', 'note'])
    w.writeheader()
    w.writerows(out)

print(f'{len(out)} activities -> {OUT} ({len(raw)} raw rows, halved to {len(rows)}, {len(skipped)} skipped)')
for reason, *row in sorted(set(skipped)):
    print(f'  SKIPPED ({reason}):', ' | '.join(row))
