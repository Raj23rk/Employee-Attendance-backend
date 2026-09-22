import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Role } from '../../../common/enums/role.enum';
import { Gender } from '../../../common/enums/gender.enum';

export type UserDocument = User & Document;

@Schema({ _id: false })
export class EmergencyContact {
  @Prop({ default: '' })
  name: string;

  @Prop({ default: '' })
  phone: string;

  @Prop({ default: '' })
  relationship: string;
}

@Schema({ _id: false })
export class BankDetails {
  @Prop({ default: '' })
  accountName: string;

  @Prop({ default: '' })
  accountNumber: string;

  @Prop({ default: '' })
  bankName: string;

  @Prop({ default: '' })
  ifscCode: string;
}

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, index: true, trim: true })
  employeeId: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, index: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true, select: false })
  password?: string;

  @Prop({ required: true, enum: Role, default: Role.EMPLOYEE })
  role: Role;

  @Prop({ required: true, enum: Gender, default: Gender.MALE })
  gender: Gender;

  @Prop({ required: true, default: 'General' })
  department: string;

  @Prop({ default: 'Staff' })
  designation: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  managerId?: MongooseSchema.Types.ObjectId | null;

  @Prop({ default: '' })
  phone?: string;

  @Prop({ default: '' })
  personalEmail?: string;

  @Prop({ default: '' })
  address?: string;

  @Prop({ type: EmergencyContact, default: () => ({}) })
  emergencyContact?: EmergencyContact;

  @Prop({ type: BankDetails, default: () => ({}) })
  bankDetails?: BankDetails;

  @Prop({ type: Date, default: null })
  dateOfJoining?: Date;

  @Prop({ type: Date, default: null })
  dateOfBirth?: Date;

  @Prop({ default: '' })
  avatarUrl?: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ select: false, default: null })
  refreshToken?: string;

  @Prop({ select: false, default: null })
  resetPasswordToken?: string;

  @Prop({ select: false, default: null })
  resetPasswordExpires?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
