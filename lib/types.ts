export type UserRole = 'Admin' | 'Staff';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: UserRole;
}

export interface AddOn {
  name: string;
  price: number;
}

export interface Size {
  name: string;
  price: number;
}

export interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  description?: string;
  imageUrl?: string;
  imageHint?: string;
  sizes?: Size[];
  addOns?: AddOn[];
}

export interface Category {
  id: string;
  name: string;
}

export interface Table {
    id: string;
    tableNumber: number;
    capacity: number;
    status: 'Available' | 'Occupied' | 'Reserved';
}


export interface OrderItem {
  menuItemId: string;
  name: string;
  quantity: number;
  price: number;
  size?: string;
  addOns?: string[];
}

export type OrderStatus = 'Pending' | 'Completed' | 'Cancelled';
export type OrderType = 'Dine-in' | 'Takeaway' | 'Delivery';

export interface Order {
  id: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  type: OrderType;
  tableId?: string;
  createdAt: any; // Firestore timestamp
}
