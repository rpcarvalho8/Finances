import { db, initDB } from '../lib/db'

async function seed() {
  await initDB()
  console.log('🌱 A inserir dados...')

  await db.execute(`DELETE FROM accounts`)
  await db.execute(`INSERT INTO accounts (name,owner,bank,type,balance,color) VALUES
    ('Conta Pessoal Rui','rui','activobank','checking',156.24,'#7eb8f9'),
    ('Conta Conjunta','conjunta','abanca','checking',0,'#f9c67e'),
    ('Conta Pessoal Ana','ana','abanca','checking',0,'#f97ec8')`)

  await db.execute(`DELETE FROM categories`)
  await db.execute(`INSERT INTO categories (name,icon,color,type,owner,budget_pct,is_business) VALUES
    ('Receita','💵','#6ef9a8','income','all',0,0),
    ('Habitação','🏠','#7eb8f9','expense','all',35,0),
    ('Alimentação','🛒','#c8f97e','expense','all',20,0),
    ('Lazer','🎭','#a07ef9','expense','all',8,0),
    ('Investimentos','📈','#6ef9a8','expense','all',0,0),
    ('Poupança','💰','#5ef0d8','expense','all',0,0),
    ('Transportes','🚗','#f9c67e','expense','all',10,0),
    ('Necessidades Básicas','📱','#f9f97e','expense','rui',50,0),
    ('Liberdade Financeira','📈','#6ef9a8','expense','rui',13,0),
    ('Despesas Carro','🚗','#f9c67e','expense','rui',10,0),
    ('Fundo de Emergência','🛡️','#f97ec8','expense','rui',10,0),
    ('Despesas Educação','📚','#f9f97e','expense','rui',5,0),
    ('Saúde','❤️','#f97ec8','expense','all',0,0),
    ('Compras','🛍️','#f96e6e','expense','all',0,0),
    ('Família','👨‍👩‍👦','#ff9fb2','expense','all',0,0),
    ('Transferências','↔️','#888','transfer','all',0,0),
    ('Utilidades','💡','#f9c67e','expense','conjunta',12,0),
    ('LUMEU','🏢','#ff9f43','expense','rui',0,1),
    ('Outros','📦','#666','expense','all',0,0)`)

  await db.execute(`DELETE FROM investments`)
  await db.execute(`INSERT INTO investments (platform,type,name,invested,current_value,owner) VALUES
    ('XTB','etf','XTB Portfolio',182.92,195.00,'rui'),
    ('Interactive Brokers','stocks','IBKR Portfolio',142.00,148.00,'rui'),
    ('Bybit','crypto','Bybit Cripto',3009.20,3100.00,'rui'),
    ('PPR (NB)','ppr','PPR Novabase',75.00,78.00,'rui'),
    ('PoupeUp','savings','PoupeUp Moneybox',566.44,566.44,'rui')`)

  await db.execute(`DELETE FROM goals`)
  await db.execute(`INSERT INTO goals (name,icon,target,saved,owner,color) VALUES
    ('Liberdade Financeira','📈',50000,44699,'rui','#6ef9a8'),
    ('Fundo de Emergência','🛡️',10000,1530,'rui','#f97ec8'),
    ('Férias 2026','✈️',3000,600,'rui','#f9c67e'),
    ('Fundo Emergência Ana','🛡️',5000,0,'ana','#6ef9a8'),
    ('Viagens conjuntas','🌍',3000,149,'familia','#a07ef9'),
    ('Obras/Decoração','🏠',5000,0,'familia','#7eb8f9')`)

  // Transações Rui
  await db.execute(`DELETE FROM transactions WHERE owner='rui'`)
  const ruiTxns = [
    ['2026-01-28','Salário Capgemini',1155.13,'income','rui','Receita'],
    ['2026-01-28','Subsídio',354.17,'income','rui','Receita'],
    ['2026-01-29','Recebimentos partilhas',136.56,'income','rui','Receita'],
    ['2026-01-02','TRF P/ PoupeUp',-141.61,'savings','rui','Poupança'],
    ['2026-01-02','Reforço Depósito Prazo',-141.61,'savings','rui','Poupança'],
    ['2026-01-05','TRF P/ XTB S.A',-91.46,'investment','rui','Investimentos'],
    ['2026-01-06','SUBSCRICAO NB PPR',-25.00,'investment','rui','Investimentos'],
    ['2026-01-15','EMERGENT (LUMEU)',-17.22,'expense','rui','LUMEU'],
    ['2026-01-16','EMERGENT (LUMEU)',-17.87,'expense','rui','LUMEU'],
    ['2026-01-20','EMERGENT (LUMEU)',-17.93,'expense','rui','LUMEU'],
    ['2026-01-20','EMERGENT (LUMEU)',-17.93,'expense','rui','LUMEU'],
    ['2026-01-20','EMERGENT (LUMEU)',-17.93,'expense','rui','LUMEU'],
    ['2026-01-13','TRF PoupeUp Emergency',-200.00,'savings','rui','Fundo de Emergência'],
    ['2026-01-05','Repsol Trofa',-67.79,'expense','rui','Transportes'],
    ['2026-01-06','DD Star Academy',-39.80,'expense','rui','Lazer'],
    ['2026-01-06','Lion of Porches',-30.15,'expense','rui','Lazer'],
    ['2026-01-06','Playtomic',-6.00,'expense','rui','Lazer'],
    ['2026-01-24','Saída Porto',-49.15,'expense','rui','Lazer'],
    ['2026-01-26','DD NOS',-16.09,'expense','rui','Necessidades Básicas'],
    ['2026-01-27','Google One',-3.24,'expense','rui','Necessidades Básicas'],
    ['2026-02-24','Salário Capgemini',1155.13,'income','rui','Receita'],
    ['2026-02-25','Salário Ana (via conjunta)',601.18,'income','rui','Receita'],
    ['2026-02-25','Recebimentos partilhas',92.50,'income','rui','Receita'],
    ['2026-02-02','TRF P/ XTB S.A',-91.46,'investment','rui','Investimentos'],
    ['2026-02-04','SUBSCRICAO NB PPR',-25.00,'investment','rui','Investimentos'],
    ['2026-02-25','Bybit',-30.00,'investment','rui','Investimentos'],
    ['2026-02-25','Bybit',-70.00,'investment','rui','Investimentos'],
    ['2026-02-03','EMERGENT (LUMEU)',-16.67,'expense','rui','LUMEU'],
    ['2026-02-03','EMERGENT (LUMEU)',-16.67,'expense','rui','LUMEU'],
    ['2026-02-10','EMERGENT (LUMEU)',-16.72,'expense','rui','LUMEU'],
    ['2026-02-10','EMERGENT (LUMEU)',-16.72,'expense','rui','LUMEU'],
    ['2026-02-13','EMERGENT (LUMEU)',-16.61,'expense','rui','LUMEU'],
    ['2026-02-02','TRF P/ PoupeUp',-141.61,'savings','rui','Poupança'],
    ['2026-02-26','Papelaria Novo Mundo',-38.60,'expense','rui','Compras'],
    ['2026-02-26','DD NOS',-16.09,'expense','rui','Necessidades Básicas'],
    ['2026-02-26','Centro Clínico Trofa',-10.00,'expense','rui','Saúde'],
    ['2026-03-02','Salário Rui Pedro Maia',855.13,'income','rui','Receita'],
    ['2026-03-02','TRF Ana Sofia (casamento)',1400.00,'income','rui','Receita'],
    ['2026-03-05','Recebimentos partilhas',39.00,'income','rui','Receita'],
    ['2026-03-04','TRF Interactive Brokers',-142.00,'investment','rui','Investimentos'],
    ['2026-03-04','SUBSCRICAO NB PPR',-25.00,'investment','rui','Investimentos'],
    ['2026-03-03','Bybit',-137.20,'investment','rui','Investimentos'],
    ['2026-03-11','Bybit (grande)',-2702.00,'investment','rui','Investimentos'],
    ['2026-03-12','Bybit',-100.00,'investment','rui','Investimentos'],
    ['2026-03-10','EMERGENT (LUMEU)',-44.76,'expense','rui','LUMEU'],
    ['2026-03-02','TRF P/ PoupeUp',-141.61,'savings','rui','Poupança'],
    ['2026-03-06','Cervejaria União',-54.10,'expense','rui','Lazer'],
    ['2026-03-13','Paypal Olaola',-29.95,'expense','rui','Compras'],
  ]
  for (const [date,desc,amount,type,owner,cat] of ruiTxns) {
    await db.execute({
      sql:`INSERT INTO transactions (date,description,amount,type,owner,category_id,account_id)
           SELECT ?,?,?,?,?,c.id,a.id FROM categories c, accounts a
           WHERE c.name=? AND a.owner='rui' LIMIT 1`,
      args:[date,desc,amount,type,owner,cat]
    })
  }

  // Transações Conjunta
  await db.execute(`DELETE FROM transactions WHERE owner='conjunta'`)
  const conjTxns = [
    ['2026-01-27','Capgemini (Salário Rui)',1155.13,'income','conjunta','Receita'],
    ['2026-01-23','Município Maia (Salário Ana)',425.77,'income','conjunta','Receita'],
    ['2026-01-08','Real Vida Seguros',354.70,'income','conjunta','Receita'],
    ['2026-01-02','Amortização/Renda',-571.73,'expense','conjunta','Habitação'],
    ['2026-01-02','DD Zurich Vida',-19.49,'expense','conjunta','Habitação'],
    ['2026-01-02','DD Águas do Norte',-8.37,'expense','conjunta','Habitação'],
    ['2026-01-07','Condomínio Fração AI',-40.33,'expense','conjunta','Habitação'],
    ['2026-01-08','Seguro Carro',-308.62,'expense','conjunta','Habitação'],
    ['2026-01-08','Condomínio Sr Augusto',-46.08,'expense','conjunta','Habitação'],
    ['2026-01-12','Tarifa Plana Seguros',-13.52,'expense','conjunta','Habitação'],
    ['2026-01-22','Renda Garagem',-50.00,'expense','conjunta','Habitação'],
    ['2026-01-22','DD Vodafone',-30.49,'expense','conjunta','Habitação'],
    ['2026-01-07','Continente Trofa',-12.97,'expense','conjunta','Alimentação'],
    ['2026-01-08','Lidl Trofa',-6.23,'expense','conjunta','Alimentação'],
    ['2026-01-14','Mercadona',-9.55,'expense','conjunta','Alimentação'],
    ['2026-01-16','Lidl Trofa',-20.07,'expense','conjunta','Alimentação'],
    ['2026-01-26','Poupa Euro',-21.00,'expense','conjunta','Alimentação'],
    ['2026-01-02','Netflix',-20.00,'expense','conjunta','Lazer'],
    ['2026-01-21','Presente Cristina',-60.00,'expense','conjunta','Lazer'],
    ['2026-02-24','Capgemini (Salário Rui)',1155.13,'income','conjunta','Receita'],
    ['2026-02-25','Município Maia (Salário Ana)',601.18,'income','conjunta','Receita'],
    ['2026-02-01','Amortização/Renda',-379.87,'expense','conjunta','Habitação'],
    ['2026-02-02','Fração AI Cota Extra',-31.20,'expense','conjunta','Habitação'],
    ['2026-02-02','Fração AH Condomínio',-48.85,'expense','conjunta','Habitação'],
    ['2026-02-02','Fração AH Cota Extra',-35.64,'expense','conjunta','Habitação'],
    ['2026-02-02','Fração AI Condomínio',-42.76,'expense','conjunta','Habitação'],
    ['2026-02-03','DD Zurich Vida',-19.49,'expense','conjunta','Habitação'],
    ['2026-02-10','Seguro',-93.00,'expense','conjunta','Habitação'],
    ['2026-02-11','Garagem + Netflix',-70.00,'expense','conjunta','Habitação'],
    ['2026-02-12','DD Indaqua',-50.38,'expense','conjunta','Habitação'],
    ['2026-02-20','DD Vodafone',-30.96,'expense','conjunta','Habitação'],
    ['2026-02-01','Auchan Maia',-55.42,'expense','conjunta','Alimentação'],
    ['2026-02-20','Lidl Trofa',-14.34,'expense','conjunta','Alimentação'],
    ['2026-02-20','Mercadona',-25.48,'expense','conjunta','Alimentação'],
    ['2026-02-17','Presente Tomás',-25.00,'expense','conjunta','Lazer'],
    ['2026-02-23','Café',-30.00,'expense','conjunta','Lazer'],
  ]
  for (const [date,desc,amount,type,owner,cat] of conjTxns) {
    await db.execute({
      sql:`INSERT INTO transactions (date,description,amount,type,owner,category_id,account_id)
           SELECT ?,?,?,?,?,c.id,a.id FROM categories c, accounts a
           WHERE c.name=? AND a.owner='conjunta' LIMIT 1`,
      args:[date,desc,amount,type,owner,cat]
    })
  }

  // LUMEU
  await db.execute(`DELETE FROM lumeu_expenses`)
  for (const [date,desc,amount] of [
    ['2026-01-15','Emergent EMERGENT.SH',17.22],
    ['2026-01-16','Emergent EMERGENT.SH',17.87],
    ['2026-01-20','Emergent EMERGENT.SH',17.93],
    ['2026-01-20','Emergent EMERGENT.SH',17.93],
    ['2026-01-20','Emergent EMERGENT.SH',17.93],
    ['2026-02-03','Emergent EMERGENT.SH',16.67],
    ['2026-02-03','Emergent EMERGENT.SH',16.67],
    ['2026-02-10','Emergent EMERGENT.SH',16.72],
    ['2026-02-10','Emergent EMERGENT.SH',16.72],
    ['2026-02-13','Emergent EMERGENT.SH',16.61],
    ['2026-03-10','Emergent EMERGENT.SH',44.76],
  ]) {
    await db.execute({
      sql:`INSERT INTO lumeu_expenses (date,description,amount,category,vendor) VALUES (?,?,?,'infra','Emergent')`,
      args:[date,desc,amount]
    })
  }

  console.log('✅ Seed completo!')
  process.exit(0)
}

seed().catch(e => { console.error(e); process.exit(1) })
