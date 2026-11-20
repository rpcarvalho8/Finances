"""Generates the SYNTHETIC ActivoBank-style statement used by tests/activobank.test.ts.

Every name, number and amount is invented. Layout follows docs/IMPORT_FORMATS.md:
section line "<TIPO> | N. <número> | MOEDA: EUR", period line, column header,
SALDO INICIAL, D.MM dates, debit/credit in separate unsigned columns, thousands
with a space, a description that wraps to a second line, a page break with the
header repeated, a PoupeUp section and a notices page to ignore.

Run: python3 tests/fixtures/activobank/generate.py
"""
import os
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

OUT = os.path.join(os.path.dirname(__file__), 'extrato-sintetico.pdf')
X = {'lanc': 40, 'valor': 85, 'desc': 135, 'deb_r': 395, 'cred_r': 465, 'saldo_r': 550}


def header(c, y):
    c.setFont('Helvetica-Bold', 7)
    c.drawString(X['lanc'], y, 'DATA LANC.')
    c.drawString(X['valor'], y, 'DATA VALOR')
    c.drawString(X['desc'], y, 'DESCRITIVO')
    c.drawRightString(X['deb_r'], y, 'DEBITO')
    c.drawRightString(X['cred_r'], y, 'CREDITO')
    c.drawRightString(X['saldo_r'], y, 'SALDO')
    c.setFont('Helvetica', 7)


def row(c, y, lanc, valor, desc, deb='', cred='', saldo=''):
    if lanc:
        c.drawString(X['lanc'], y, lanc)
    if valor:
        c.drawString(X['valor'], y, valor)
    c.drawString(X['desc'], y, desc)
    if deb:
        c.drawRightString(X['deb_r'], y, deb)
    if cred:
        c.drawRightString(X['cred_r'], y, cred)
    if saldo:
        c.drawRightString(X['saldo_r'], y, saldo)


c = canvas.Canvas(OUT, pagesize=A4)
c.setTitle('Extrato combinado (exemplo sintetico)')
# Page 1: checking account, Dec 2025 -> Jan 2026
c.setFont('Helvetica-Bold', 9)
c.drawString(40, 800, 'EXTRATO COMBINADO')
c.setFont('Helvetica', 8)
c.drawString(40, 785, 'CLIENTE EXEMPLO')
c.drawString(40, 760, 'CONTA SIMPLES | N. 0001234567 | MOEDA: EUR')
c.drawString(40, 748, 'EXTRATO DE 2025/12/01 A 2026/01/31')
header(c, 730)
y = 716
for r in [
    ('', '', 'SALDO INICIAL', '', '', '1 000.00'),
    ('1.12', '1.12', 'TRF DE EMPRESA EXEMPLO', '', '1 556.00', '2 556.00'),
    ('3.12', '3.12', 'COMPRA 1234 SUPERMERCADO EXEMPLO', '45.30', '', '2 510.70'),
    ('15.12', '15.12', 'TRF P/ PoupeUp - Ferias', '100.00', '', '2 410.70'),
]:
    row(c, y, *r)
    y -= 12
# wrapped description
row(c, y, '20.12', '21.12', 'PAGAMENTO SERVICOS EXEMPLO', '30.00', '', '2 380.70'); y -= 10
row(c, y, '', '', 'REF. 000 111 222'); y -= 12
c.drawString(40, 60, 'Pagina 1 de 3')
c.showPage()
# Page 2: continuation (header repeated), then PoupeUp section
c.setFont('Helvetica', 8)
header(c, 800)
y = 786
for r in [
    ('2.01', '2.01', 'TRF DE PoupeUp - Ferias', '', '50.00', '2 430.70'),
    ('5.01', '5.01', 'COMPRA 1234 FARMACIA EXEMPLO', '12.40', '', '2 418.30'),
    ('5.01', '5.01', 'COMPRA 1234 FARMACIA EXEMPLO', '12.40', '', '2 405.90'),
]:
    row(c, y, *r)
    y -= 12
row(c, y, '', '', 'SALDO FINAL', '', '', '2 405.90'); y -= 30
c.setFont('Helvetica', 8)
c.drawString(40, y, 'POUPEUP | N. 0007654321 | MOEDA: EUR'); y -= 12
c.drawString(40, y, 'EXTRATO DE 2025/12/01 A 2026/01/31'); y -= 18
header(c, y); y -= 14
for r in [
    ('', '', 'SALDO INICIAL', '', '', '200.00'),
    ('15.12', '15.12', 'TRF DE CONTA SIMPLES', '', '100.00', '300.00'),
    ('2.01', '2.01', 'TRF P/ CONTA SIMPLES', '50.00', '', '250.00'),
]:
    row(c, y, *r)
    y -= 12
c.drawString(40, 60, 'Pagina 2 de 3')
c.showPage()
# Page 3: notices (must be ignored)
c.setFont('Helvetica', 8)
c.drawString(40, 800, 'INFORMACOES E AVISOS')
c.drawString(40, 785, 'Exemplo de texto legal 12.34 que nao e um movimento.')
c.drawString(40, 60, 'Pagina 3 de 3')
c.showPage()
c.save()
print(OUT)
