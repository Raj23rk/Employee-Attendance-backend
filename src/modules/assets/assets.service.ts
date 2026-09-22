import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Asset, AssetDocument } from './schemas/asset.schema';
import { ServiceRequestDto } from './dto/asset.dto';

@Injectable()
export class AssetsService {
  constructor(@InjectModel(Asset.name) private assetModel: Model<AssetDocument>) {}

  async getMyAssets(userId: string) {
    let assets = await this.assetModel
      .find({ assignedToId: new Types.ObjectId(userId) })
      .exec();

    if (assets.length === 0) {
      // Seed default assigned assets
      assets = [
        await this.assetModel.create({
          assetTag: 'AST-LAP-042',
          name: 'MacBook Pro 16" M3 Pro 36GB',
          category: 'Laptop',
          assignedToId: new Types.ObjectId(userId),
          status: 'ASSIGNED',
          assignedDate: new Date(),
        }),
        await this.assetModel.create({
          assetTag: 'AST-MON-108',
          name: 'Dell UltraSharp 27" 4K Monitor',
          category: 'Monitor',
          assignedToId: new Types.ObjectId(userId),
          status: 'ASSIGNED',
          assignedDate: new Date(),
        }),
      ];
    }

    return { success: true, count: assets.length, data: assets };
  }

  async createServiceRequest(assetId: string, userId: string, dto: ServiceRequestDto) {
    const asset = await this.assetModel.findOne({
      _id: assetId,
      assignedToId: new Types.ObjectId(userId),
    });

    if (!asset) {
      throw new NotFoundException('Asset not found or not assigned to current user');
    }

    asset.serviceRequests.push({
      requestType: dto.requestType,
      description: dto.description,
      status: 'OPEN',
      requestedAt: new Date(),
    });

    await asset.save();

    return { success: true, message: 'Asset service request registered', data: asset };
  }
}
