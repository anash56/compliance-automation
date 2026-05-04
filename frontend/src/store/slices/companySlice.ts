import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { logout } from './authSlice';

interface CompanyState {
  companies: any[];
  selectedCompanyId: string | null;
}

const initialState: CompanyState = {
  companies: [],
  selectedCompanyId: localStorage.getItem('selectedCompanyId')
};

const companySlice = createSlice({
  name: 'company',
  initialState,
  reducers: {
    setCompanies: (state, action: PayloadAction<any[]>) => {
      state.companies = action.payload;

      if (
        state.selectedCompanyId &&
        !action.payload.some((company) => company.id === state.selectedCompanyId)
      ) {
        state.selectedCompanyId = null;
        localStorage.removeItem('selectedCompanyId');
      }

      if (!state.selectedCompanyId && action.payload.length > 0) {
        state.selectedCompanyId = action.payload[0].id;
        localStorage.setItem('selectedCompanyId', action.payload[0].id);
      }
    },
    addCompany: (state, action: PayloadAction<any>) => {
      state.companies = [action.payload, ...state.companies];
      state.selectedCompanyId = action.payload.id;
      localStorage.setItem('selectedCompanyId', action.payload.id);
    },
    updateCompany: (state, action: PayloadAction<any>) => {
      state.companies = state.companies.map((company) =>
        company.id === action.payload.id ? action.payload : company
      );
    },
    removeCompany: (state, action: PayloadAction<string>) => {
      state.companies = state.companies.filter(c => c.id !== action.payload);
      if (state.selectedCompanyId === action.payload) {
        const nextCompany = state.companies.length > 0 ? state.companies[0].id : null;
        state.selectedCompanyId = nextCompany;
        if (nextCompany) {
          localStorage.setItem('selectedCompanyId', nextCompany);
        } else {
          localStorage.removeItem('selectedCompanyId');
        }
      }
    },
    setSelectedCompanyId: (state, action: PayloadAction<string>) => {
      state.selectedCompanyId = action.payload;
      localStorage.setItem('selectedCompanyId', action.payload);
    }
  },
  extraReducers: (builder) => {
    builder.addCase(logout.fulfilled, (state) => {
      state.companies = [];
      state.selectedCompanyId = null;
      localStorage.removeItem('selectedCompanyId');
    });
  }
});

export const { addCompany, setCompanies, setSelectedCompanyId, updateCompany, removeCompany } = companySlice.actions;
export default companySlice.reducer;
