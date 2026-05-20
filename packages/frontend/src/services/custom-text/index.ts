import { BaseApiService } from '../base';
import config from '@/config/config';

export interface CustomText {
  id: number;
  text: string;
  isTitle: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomTextCreate {
  text: string;
  isTitle: boolean;
}

export interface CustomTextUpdate {
  text?: string;
  isTitle?: boolean;
}

class CustomTextService extends BaseApiService {
  constructor() {
    super(config.api.endpoints.customTexts.base);
  }

  // Get all custom texts
  async getCustomTexts(): Promise<CustomText[]> {
    try {
      return await this.get<CustomText[]>();
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Get custom text by ID
  async getCustomTextById(id: number): Promise<CustomText> {
    try {
      return await this.get<CustomText>(`/${id}`);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Create new custom text
  async createCustomText(data: CustomTextCreate): Promise<CustomText> {
    try {
      return await this.post<CustomText>('', data);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Update custom text
  async updateCustomText(id: number, data: CustomTextUpdate): Promise<CustomText> {
    try {
      return await this.put<CustomText>(`/${id}`, data);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Delete custom text
  async deleteCustomText(id: number): Promise<void> {
    try {
      await this.delete(`/${id}`);
    } catch (error) {
      throw this.handleError(error);
    }
  }
}

export default new CustomTextService();