import categoriesData from './reimbursement-categories.json';

interface Category {
  value: string;
  title: string;
  expenseTypes: Array<{
    value: string;
    title: string;
  }>;
}

const categories = categoriesData as Category[];

export interface CategoryMapping {
  categoryValue: string;
  expenseTypeValue: string;
}

/**
 * Maps OCR category to Darwinbox reimbursement category and expense type
 * @param ocrCategory - Category from OCR (e.g., "Travel", "Food", "Accommodation")
 * @param description - Expense description (e.g., "Airport transfer to...", "Local conveyance to...", "Restaurant meal")
 * @param merchant - Merchant name (e.g., "Rapido", "Uber", "Restaurant Name")
 * @returns Category mapping with categoryValue and expenseTypeValue
 */
export function mapCategoryToReimbursement(
  ocrCategory: string,
  description: string,
  merchant: string
): CategoryMapping {
  const desc = (description || '').toLowerCase();
  const merch = (merchant || '').toLowerCase();
  const category = (ocrCategory || '').toLowerCase();

  // Business Travel Expense category
  const businessTravelCategory = categories.find(cat => cat.value === 'a66f40962b1f55');
  if (!businessTravelCategory) {
    // Fallback if category not found
    return {
      categoryValue: 'a66f40962b1f55',
      expenseTypeValue: 'a64aea3aa222d4', // Business Travel - Local conveyance
    };
  }

  // Check for Airport Transfer
  const airportKeywords = ['airport transfer', 'airport', 'terminal', 'to airport'];
  const isAirportTransfer = airportKeywords.some(keyword => desc.includes(keyword));
  if (isAirportTransfer) {
    const airportTransferType = businessTravelCategory.expenseTypes.find(
      et => et.title.toLowerCase().includes('airport transfer') && !et.title.includes('VP')
    );
    if (airportTransferType) {
      return {
        categoryValue: businessTravelCategory.value,
        expenseTypeValue: airportTransferType.value,
      };
    }
  }

  // Check for Local Conveyance
  const conveyanceKeywords = ['local conveyance', 'taxi', 'rapido', 'uber', 'ola', 'ride', 'cab'];
  const isLocalConveyance = conveyanceKeywords.some(keyword => 
    desc.includes(keyword) || merch.includes(keyword)
  );
  if (isLocalConveyance && !isAirportTransfer) {
    const localConveyanceType = businessTravelCategory.expenseTypes.find(
      et => et.title.toLowerCase().includes('local conveyance') && !et.title.includes('VP')
    );
    if (localConveyanceType) {
      return {
        categoryValue: businessTravelCategory.value,
        expenseTypeValue: localConveyanceType.value,
      };
    }
  }

  // Check for Meals/Food
  const mealKeywords = [
    'meal', 'lunch', 'dinner', 'breakfast', 'restaurant', 'food', 'dining',
    'catering', 'swiggy', 'zomato', 'food expense', 'business lunch'
  ];
  const isMeal = mealKeywords.some(keyword => 
    desc.includes(keyword) || merch.includes(keyword) || category === 'food' || category === 'travel'
  );
  if (isMeal) {
    const mealType = businessTravelCategory.expenseTypes.find(
      et => et.title.toLowerCase().includes('meals') && !et.title.includes('VP')
    );
    if (mealType) {
      return {
        categoryValue: businessTravelCategory.value,
        expenseTypeValue: mealType.value,
      };
    }
  }

  // Check for Accommodation/Hotel
  const hotelKeywords = ['hotel', 'lodging', 'accommodation', 'stay'];
  const isHotel = hotelKeywords.some(keyword => 
    desc.includes(keyword) || merch.includes(keyword) || category === 'accommodation'
  );
  if (isHotel) {
    // Default to "Lodging Less than 5 days" for hotels
    const lodgingType = businessTravelCategory.expenseTypes.find(
      et => et.title.toLowerCase().includes('lodging less than 5 days') && !et.title.includes('VP')
    );
    if (lodgingType) {
      return {
        categoryValue: businessTravelCategory.value,
        expenseTypeValue: lodgingType.value,
      };
    }
  }

  // Check for Flight
  const flightKeywords = ['flight', 'airline', 'air ticket'];
  const isFlight = flightKeywords.some(keyword => 
    desc.includes(keyword) || merch.includes(keyword)
  );
  if (isFlight) {
    const flightType = businessTravelCategory.expenseTypes.find(
      et => et.title.toLowerCase().includes('flight') && !et.title.includes('VP')
    );
    if (flightType) {
      return {
        categoryValue: businessTravelCategory.value,
        expenseTypeValue: flightType.value,
      };
    }
  }

  // Default mappings based on category
  if (category === 'travel' || category === 'food') {
    // Default to Business Travel - Meals for food/travel
    const mealType = businessTravelCategory.expenseTypes.find(
      et => et.title.toLowerCase().includes('meals') && !et.title.includes('VP')
    );
    if (mealType) {
      return {
        categoryValue: businessTravelCategory.value,
        expenseTypeValue: mealType.value,
      };
    }
  }

  // Default fallback: Business Travel - Local conveyance
  const defaultType = businessTravelCategory.expenseTypes.find(
    et => et.title.toLowerCase().includes('local conveyance') && !et.title.includes('VP')
  );
  
  return {
    categoryValue: businessTravelCategory.value,
    expenseTypeValue: defaultType?.value || 'a64aea3aa222d4', // Business Travel - Local conveyance
  };
}
