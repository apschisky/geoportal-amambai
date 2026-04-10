import urllib.request
import urllib.parse

# Testar a requisição WMS
url = 'https://geoserver.amambai.ms.gov.br/geoserver/ne/wms'
params = {
    'SERVICE': 'WMS',
    'VERSION': '1.1.0',
    'REQUEST': 'GetMap',
    'LAYERS': 'ne:Unidades de Conservacao',
    'FORMAT': 'image/png',
    'SRS': 'EPSG:32721',
    'BBOX': '-55.43307876586914,-23.565656661987305,-54.468841552734375,-22.871171951293945',
    'WIDTH': '768',
    'HEIGHT': '553',
    'STYLES': ''
}

encoded_params = urllib.parse.urlencode(params)
full_url = url + '?' + encoded_params

print('URL:', full_url)

req = urllib.request.Request(full_url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req, timeout=30) as response:
        print('Status:', response.status)
        print('Content-Type:', response.getheader('Content-Type'))
        data = response.read(100)
        print('Data length:', len(data))
        if data:
            print('Starts with:', data[:20])
except Exception as e:
    print('Error:', e)