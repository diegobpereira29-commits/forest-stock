/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import Assistant from './pages/Assistant';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Losses from './pages/Losses';
import Movements from './pages/Movements';
import Products from './pages/Products';
import Projects from './pages/Projects';
import Reports from './pages/Reports';
import Stock from './pages/Stock';
import Suppliers from './pages/Suppliers';
import Users from './pages/Users';
import TeamAudit from './pages/TeamAudit';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Assistant": Assistant,
    "Dashboard": Dashboard,
    "Inventory": Inventory,
    "Losses": Losses,
    "Movements": Movements,
    "Products": Products,
    "Projects": Projects,
    "Reports": Reports,
    "Stock": Stock,
    "Suppliers": Suppliers,
    "Users": Users,
    "TeamAudit": TeamAudit,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};