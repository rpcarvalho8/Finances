const { createClient } = require('@libsql/client');
const client = createClient({ url: 'file:local.db' });

async function main() {
  console.log("🚀 A iniciar a criação da estrutura no teu local.db...");

  // 1. Criar tabela de categorias (necessária para o LEFT JOIN c.name do teu código)
  await client.execute(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT
    );
  `);

  // 2. Criar tabela de transações
  await client.execute(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      amount REAL NOT NULL,
      description TEXT,
      date TEXT NOT NULL,
      category_id TEXT,
      type TEXT CHECK(type IN ('income', 'expense'))
    );
  `);

  // 3. Criar tabela de investimentos
  await client.execute(`
    CREATE TABLE IF NOT EXISTS investments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT,
      balance REAL DEFAULT 0,
      updated_at TEXT
    );
  `);

  // 4. Criar tabela de objetivos (goals)
  await client.execute(`
    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      target REAL NOT NULL,
      current REAL DEFAULT 0,
      active INTEGER DEFAULT 1,
      owner TEXT
    );
  `);

  console.log("✨ Tabelas criadas com sucesso!");

  // 5. Inserir dados fictícios para a página inicial não aparecer vazia
  console.log("🌱 A inserir dados de teste para os teus gráficos...");
  
  // Categorias base
  await client.execute("INSERT OR IGNORE INTO categories VALUES ('1', 'Trading Forex', 'trending-up')");
  await client.execute("INSERT OR IGNORE INTO categories VALUES ('2', 'Crypto', 'bitcoin')");
  
  // Uma transação fictícia deste mês para satisfazer o filtro do teu page.tsx
  const currentMonth = new Date().toISOString().slice(0, 7);
  await client.execute(`
    INSERT OR IGNORE INTO transactions VALUES 
    ('t1', 1500.0, 'Ganho Prop Firm FTMO', '${currentMonth}-05', '1', 'income')
  `);

  // Um objetivo ativo
  await client.execute(`
    INSERT OR IGNORE INTO goals VALUES 
    ('g1', 'Conta Pessoal 10k', 10000.0, 2500.0, 1, 'Rui')
  `);

  console.log("✅ Processo concluído! O teu banco de dados local está pronto.");
  process.exit(0);
}

main().catch(err => {
  console.error("❌ Erro ao criar o banco de dados:", err);
  process.exit(1);
});
