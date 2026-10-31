"""Set search assets after the team has a production address."""
import re
import sys
from pathlib import Path
from urllib.parse import urlsplit
from xml.sax.saxutils import escape


def main():
    if len(sys.argv) != 2:
        raise SystemExit('Usage: python3 docs/configure-domain.py https://your-production-host')
    value = urlsplit(sys.argv[1])
    if (value.scheme != 'https' or not value.hostname or value.username or value.password
            or value.path not in ('', '/') or value.query or value.fragment
            or value.hostname.endswith('.invalid') or value.port is not None
            or not re.fullmatch(r'[A-Za-z0-9.-]+', value.hostname)):
        raise SystemExit('Use a real HTTPS hostname with no path, credentials, port, query or fragment.')
    origin = 'https://' + value.hostname
    root = Path(__file__).resolve().parent.parent
    html_path = root / 'index.html'
    html = html_path.read_text()
    if not re.search(r'^[ \t]*</head>', html, flags=re.M):
        raise SystemExit('Unexpected head formatting; no files were changed.')
    html = re.sub(r'^[ \t]*<link\b(?=[^>]*\brel=[\"\']canonical[\"\'])[^>]*>[ \t]*\n?', '', html, flags=re.M)
    html = re.sub(r'^[ \t]*<meta\b(?=[^>]*\bproperty=[\"\']og:url[\"\'])[^>]*>[ \t]*\n?', '', html, flags=re.M)
    html = re.sub(r'^[ \t]*</head>', '    <link rel="canonical" href="' + origin + '/" />\n'
                  '    <meta property="og:url" content="' + origin + '/" />\n  </head>', html, count=1, flags=re.M)
    sitemap = ('<?xml version="1.0" encoding="UTF-8"?>\n'
               '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
               '  <url><loc>' + escape(origin) + '/</loc></url>\n'
               '  <url><loc>' + escape(origin) + '/book</loc></url>\n</urlset>\n')
    robots_path = root / 'public/robots.txt'
    robots = '\n'.join(line for line in robots_path.read_text().splitlines()
                       if not line.lower().startswith(('sitemap:', '# add sitemap:')))
    robots_path.write_text(robots.rstrip() + '\n\nSitemap: ' + origin + '/sitemap.xml\n')
    (root / 'public/sitemap.xml').write_text(sitemap)
    html_path.write_text(html)
    print('Updated sitemap, robots.txt, canonical URL and og:url for ' + origin)


if __name__ == '__main__':
    main()
