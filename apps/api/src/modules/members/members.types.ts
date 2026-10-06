/**
 * Member Module Types & Contracts (Phase 5.1)
 * 
 * Defines domain entities, database row contracts, and DTOs for the
 * association's membership foundation.
 */

export type RelationshipType = 'FATHER' | 'MOTHER' | 'HUSBAND' | 'WIFE' | 'SON' | 'DAUGHTER' | 'OTHER';
export type MemberStatus = 'ACTIVE' | 'INACTIVE';

/**
 * Domain entity representing an association member.
 */
export interface Member {
  id: string;
  memberNumber: string;
  memberName: string;
  relatedPersonName: string;
  relatedPersonRelationship: RelationshipType;
  shopName: string | null;
  address: string;
  mobileNumber: string;
  numberOfSheets: number;
  nomineeName: string | null;
  nomineeRelationship: string | null;
  nomineePhone: string | null;
  insuranceNumber: string | null;
  
  joinDate?: Date;
  dailyCollectionAmount?: number;
  shopCategory?: string;
  shopContactNumber?: string;
  shopEmail?: string;
  tradeLicense?: string;
  
  successorName?: string;
  successorRelationship?: string;
  successorContactNumber?: string;
  successorAlternateContact?: string;
  successorEmail?: string;
  successorTakeoverDate?: string;
  successorResidentialAddress?: string;
  successorRemarks?: string;

  status: MemberStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Raw database row shape for `members`.
 */
export interface MemberRow {
  id: string;
  member_number: string;
  member_name: string;
  related_person_name: string;
  related_person_relationship: RelationshipType;
  shop_name: string | null;
  address: string;
  mobile_number: string;
  number_of_sheets: number;
  nominee_name: string | null;
  nominee_relationship: string | null;
  nominee_phone: string | null;
  insurance_number: string | null;
  
  join_date?: Date;
  daily_collection_amount?: string;
  shop_category?: string;
  shop_contact_number?: string;
  shop_email?: string;
  trade_license?: string;
  
  successor_name?: string;
  successor_relationship?: string;
  successor_contact_number?: string;
  successor_alternate_contact?: string;
  successor_email_address?: string;
  successor_expected_takeover_date?: string;
  successor_residential_address?: string;
  successor_remarks?: string;

  status: MemberStatus;
  created_at: Date;
  updated_at: Date;
}

/**
 * Input DTO for creating a member.
 */
export interface CreateMemberDto {
  memberNumber: string;
  memberName: string;
  mobileNumber: string;
  numberOfSheets: number; // For now keeping this as is, maybe rename later
  dailyCollectionAmount?: number;
  joinDate?: Date;
  shopName?: string;
  shopCategory?: string;
  shopContactNumber?: string;
  shopEmail?: string;
  tradeLicense?: string;
  relatedPersonName: string;
  relatedPersonRelationship: RelationshipType;
  address: string;
  
  // Successor info
  successorName?: string;
  successorRelationship?: string;
  successorContactNumber?: string;
  successorAlternateContact?: string;
  successorEmail?: string;
  successorTakeoverDate?: string;
  successorResidentialAddress?: string;
  successorRemarks?: string;

  nomineeName?: string; // Legacy
  nomineeRelationship?: string; // Legacy
  nomineePhone?: string; // Legacy
  insuranceNumber?: string;
  status?: MemberStatus;
}

/**
 * Input DTO for updating a member.
 */
export interface UpdateMemberDto {
  memberName?: string;
  relatedPersonName?: string;
  relatedPersonRelationship?: RelationshipType;
  shopName?: string | null;
  address?: string;
  mobileNumber?: string;
  numberOfSheets?: number;
  nomineeName?: string | null;
  nomineeRelationship?: string | null;
  nomineePhone?: string | null;
  insuranceNumber?: string | null;
  status?: MemberStatus;
}

/**
 * Read-only profile view of an association member (Phase 5.3).
 * Exposes verified member identity fields without internal database metadata.
 */
export interface MemberProfile {
  memberNumber: string;
  memberName: string;
  relatedPersonName: string;
  relatedPersonRelationship: RelationshipType;
  shopName: string | null;
  address: string;
  mobileNumber: string;
  numberOfSheets: number;
  nomineeName: string | null;
  nomineeRelationship: string | null;
  nomineePhone: string | null;
  insuranceNumber: string | null;
  status: MemberStatus;

  joinDate?: string;
  dailyCollectionAmount?: number;
  shopCategory?: string;
  shopContactNumber?: string;
  shopEmail?: string;
  tradeLicense?: string;
  
  successorName?: string;
  successorRelationship?: string;
  successorContactNumber?: string;
  successorAlternateContact?: string;
  successorEmail?: string;
  successorTakeoverDate?: string;
  successorResidentialAddress?: string;
  successorRemarks?: string;

  createdAt: string;
  updatedAt: string;
}

/**
 * Explicit column row contract for member profile database queries.
 */
export interface MemberProfileRow {
  member_number: string;
  member_name: string;
  related_person_name: string;
  related_person_relationship: RelationshipType;
  shop_name: string | null;
  address: string;
  mobile_number: string;
  number_of_sheets: number | string;
  nominee_name: string | null;
  nominee_relationship: string | null;
  nominee_phone: string | null;
  insurance_number: string | null;
  status: MemberStatus;

  join_date?: Date;
  daily_collection_amount?: string;
  shop_category?: string;
  shop_contact_number?: string;
  shop_email?: string;
  trade_license?: string;
  
  successor_name?: string;
  successor_relationship?: string;
  successor_contact_number?: string;
  successor_alternate_contact?: string;
  successor_email_address?: string;
  successor_expected_takeover_date?: string;
  successor_residential_address?: string;
  successor_remarks?: string;

  created_at: Date;
  updated_at: Date;
}

