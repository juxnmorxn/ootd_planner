/**
 * WatermelonDB Models
 */

import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export class UserModel extends Model {
  static table = 'users';

  @field('email') email!: string;
  @field('username') username!: string;
  @field('password_hash') password_hash!: string;
  @field('profile_pic') profile_pic?: string;
  @field('role') role!: string;
  @field('custom_subcategories') custom_subcategories?: string;
}

export class GarmentModel extends Model {
  static table = 'garments';

  @field('user_id') user_id!: string;
  @field('category') category!: string;
  @field('sub_category') sub_category!: string;
  @field('image_url') image_url!: string;
  @field('cloudinary_id') cloudinary_id!: string;
}

export class OutfitModel extends Model {
  static table = 'outfits';

  @field('user_id') user_id!: string;
  @field('date_scheduled') date_scheduled!: string;
  @field('option_index') option_index!: number;
  @field('layers_json') layers_json!: string;
}
