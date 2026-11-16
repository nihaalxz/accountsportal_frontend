export interface LoginResponse {
	accessToken: string;
	refreshToken: string;
	userType: string;
	name: string;
	email: string;
	portalPermissions: string[];
	profilePicture?: string;
}

export interface RefreshTokenResponse {
	accessToken: string;
	refreshToken: string;
}

export interface UserProfileResponse {
	id: number;
	name: string;
	email: string;
	userType: string;
	portalPermissions: string[];
	isActive: boolean;
	profilePicture?: string;
}

export interface SessionUser {
	id?: number;
	name: string;
	email: string;
	userType: string;
	permissions: string[];
	profilePicture?: string;
}
