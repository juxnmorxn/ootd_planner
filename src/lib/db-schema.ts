/**
 * WatermelonDB Schema Definition
 */

import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'users',
      columns: [
        { name: 'email', type: 'string', isIndexed: true },
        { name: 'username', type: 'string', isIndexed: true },
        { name: 'password_hash', type: 'string' },
        { name: 'profile_pic', type: 'string', isOptional: true },
        { name: 'role', type: 'string' }, // 'admin' | 'user'
        { name: 'custom_subcategories', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    tableSchema({
      name: 'garments',
      columns: [
        { name: 'user_id', type: 'string', isIndexed: true },
        { name: 'category', type: 'string', isIndexed: true },
        { name: 'sub_category', type: 'string' },
        { name: 'image_url', type: 'string' },
        { name: 'cloudinary_id', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    tableSchema({
      name: 'outfits',
      columns: [
        { name: 'user_id', type: 'string', isIndexed: true },
        { name: 'date_scheduled', type: 'string', isIndexed: true },
        { name: 'option_index', type: 'number' },
        { name: 'layers_json', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
  ],
});
