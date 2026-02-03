/**
 * WatermelonDB Models
 */

import { Model } from '@nozbe/watermelondb';
import { text, number, readonly, writer } from '@nozbe/watermelondb/decorators';

export class UserModel extends Model {
  static table = 'users';

  @text('email') email!: string;
  @text('username') username!: string;
  @text('password_hash') password_hash!: string;
  @text('profile_pic') profile_pic?: string;
  @text('role') role!: string;
  @text('custom_subcategories') custom_subcategories?: string;
  @readonly
  @number('created_at')
  createdAt!: number;
  @readonly
  @number('updated_at')
  updatedAt!: number;
}

export class GarmentModel extends Model {
  static table = 'garments';

  @text('user_id') user_id!: string;
  @text('category') category!: string;
  @text('sub_category') sub_category!: string;
  @text('image_url') image_url!: string;
  @text('cloudinary_id') cloudinary_id!: string;
  @readonly
  @number('created_at')
  createdAt!: number;
  @readonly
  @number('updated_at')
  updatedAt!: number;
}

export class OutfitModel extends Model {
  static table = 'outfits';

  @text('user_id') user_id!: string;
  @text('date_scheduled') date_scheduled!: string;
  @number('option_index') option_index!: number;
  @text('layers_json') layers_json!: string;
  @readonly
  @number('created_at')
  createdAt!: number;
  @readonly
  @number('updated_at')
  updatedAt!: number;
}
