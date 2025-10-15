export type PaginatedResponse<T> = {
  items?: T[];
  next?: string | null;
  tracks?: {
    items: T[];
    next: string | null;
  };
  artists?: {
    items: T[];
    next: string | null;
  };
};
