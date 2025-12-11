import axios from 'axios';
import { promises as fs } from 'fs';
import { join } from 'path';

const API_URL = 'http://localhost:3000/api/metadata'; // Adjust if needed
const OUTPUT_DIR = join(__dirname, '../libs/generated-types/src/lib');

async function generateTypes() {
  try {
    console.log('Fetching metadata...');
    // This assumes we have an endpoint to list all models/tables. 
    // svc-metadata has /models (ModelController) and /tables (TablesController).
    // Let's support both or just one. The plan said "fetch metadata from API".
    
    // For now, let's just fetch tables from TablesController as an example of dynamic types
    const response = await axios.get(`${API_URL}/tables`);
    const tables = response.data;

    // Ensure output directory exists
    await fs.mkdir(OUTPUT_DIR, { recursive: true }).catch(() => {});

    let content = `// Auto-generated types\n\n`;

    for (const table of tables) {
      const className = table.tableName.charAt(0).toUpperCase() + table.tableName.slice(1);
      content += `export interface ${className} {\n`;
      content += `  id: string;\n`;
      
      for (const field of table.fields) {
        let tsType = 'any';
        switch (field.type) {
          case 'string':
          case 'text':
          case 'email':
          case 'url':
          case 'phone':
          case 'reference':
          case 'user_reference':
          case 'choice': // Could be union if options known
            tsType = 'string';
            break;
          case 'integer':
          case 'decimal':
          case 'number':
          case 'currency':
          case 'percent':
            tsType = 'number';
            break;
          case 'boolean':
            tsType = 'boolean';
            break;
          case 'date':
          case 'datetime':
            tsType = 'Date | string';
            break;
          case 'json':
            tsType = 'any';
            break;
        }
        
        const optional = !field.required ? '?' : '';
        content += `  ${field.name}${optional}: ${tsType};\n`;
      }
      
      content += `}\n\n`;
    }

    await fs.writeFile(join(OUTPUT_DIR, 'index.d.ts'), content);
    console.log(`Types generated in ${OUTPUT_DIR}/index.d.ts`);

  } catch (error) {
    console.error('Error generating types:', error);
  }
}

generateTypes();
