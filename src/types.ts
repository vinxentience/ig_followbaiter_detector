export interface InstagramProfile {
  username: string;
  profileLink: string;
  timestamp?: number;
}

export interface Statistics {
  followersCount: number;
  followingCount: number;
  notFollowingBackCount: number;
}
