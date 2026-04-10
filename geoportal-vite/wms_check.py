import urllib.request
import re

url = 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms?service=WMS&version=1.1.0&request=GetCapabilities'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req, timeout=30) as response:
    xml = response.read().decode('utf-8', 'ignore')

print('LENGTH', len(xml))
print('HAS_UNIDADES', 'Unidades' in xml)
print('HAS_conserva', 'conserva' in xml.lower())

# Print all layer names
for m in re.finditer(r'<Name>([^<]+)</Name>', xml):
    name = m.group(1)
    if 'unidades' in name.lower() or 'conserva' in name.lower():
        print('MATCH', repr(name))
    elif 'ne:' in name and ('unidades' in name.lower() or 'conserva' in name.lower()):
        print('NE_MATCH', repr(name))
