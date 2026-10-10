import { useState, useRef, useEffect } from 'react';
import {
  HeartPulse,
  ClipboardList,
  Pill,
  UtensilsCrossed,
  Phone,
  AlertTriangle,
  Plus,
  Clock,
  X,
  Check,
  Upload,
  FileText,
  ChevronRight,
  Calendar,
  Utensils,
  Beef,
  Salad,
  Milk,
  IceCream,
  User,
  Paperclip,
  Download,
  Maximize2,
  ScanLine,
  XCircle,
  Camera,
  Trash2,
  Pencil,
  Barcode,
  Loader2,
} from 'lucide-react';
import { Modal } from '@/components/Modal';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { children, careRecords as initialCareRecords, animators } from '@/data/mockData';
import { getInitials, getAvatarColor } from '@/utils/helpers';
import type { CareRecord, BoboType, MenuDish, MenuCategory, DayMenu } from '@/types';

type SubView = 'grid' | 'pai' | 'registre' | 'pharmacie' | 'menus';

const ALL_ALLERGENS = ['Gluten', 'Lactose', 'Arachides', 'Fruits à coque', 'Œuf', 'Poisson', 'Soja', 'Sésame', 'Mollusques', 'Crustacés', 'Moutarde', 'Céleri'];

const BOBO_TYPES: BoboType[] = ['Chute', 'Égratignure', 'Bosse', 'Mal de ventre', 'Plaie', 'Morsure', 'Autre'];

const CATEGORY_ICONS: Record<MenuCategory, typeof Salad> = {
  'Entrée': Salad,
  'Plat': Beef,
  'Garniture': Utensils,
  'Produit laitier': Milk,
  'Dessert': IceCream,
};

const WEEKDAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];

// Simulated OCR results for demo
const OCR_DEMO_DISHES: MenuDish[] = [
  { id: 'ocr-e', name: 'Carottes râpées vinaigrette', category: 'Entrée', allergens: ['Gluten', 'Moutarde'] },
  { id: 'ocr-p', name: 'Hachis Parmentier', category: 'Plat', allergens: ['Gluten', 'Lactose'] },
  { id: 'ocr-g', name: 'Haricots verts', category: 'Garniture', allergens: [] },
  { id: 'ocr-l', name: 'Yaourt nature', category: 'Produit laitier', allergens: ['Lactose'] },
  { id: 'ocr-d', name: 'Tarte aux pommes', category: 'Dessert', allergens: ['Gluten', 'Œuf', 'Lactose'] },
];

function getDefaultWeekMenu(): DayMenu[] {
  return WEEKDAYS.map((day) => ({
    day,
    documentUrl: null,
    dishes: [
      { id: `${day}-e`, name: '', category: 'Entrée' as MenuCategory, allergens: [] },
      { id: `${day}-p`, name: '', category: 'Plat' as MenuCategory, allergens: [] },
      { id: `${day}-g`, name: '', category: 'Garniture' as MenuCategory, allergens: [] },
      { id: `${day}-l`, name: '', category: 'Produit laitier' as MenuCategory, allergens: [] },
      { id: `${day}-d`, name: '', category: 'Dessert' as MenuCategory, allergens: [] },
    ],
  }));
}

function getDemoWeekMenu(): DayMenu[] {
  const days = getDefaultWeekMenu();
  const mon = days[0];
  mon.dishes[0] = { id: 'mon-e', name: 'Salade composée', category: 'Entrée', allergens: ['Gluten'] };
  mon.dishes[1] = { id: 'mon-p', name: 'Poulet rôti', category: 'Plat', allergens: [] };
  mon.dishes[2] = { id: 'mon-g', name: 'Pommes dauphines', category: 'Garniture', allergens: ['Lactose', 'Gluten'] };
  mon.dishes[3] = { id: 'mon-l', name: 'Fromage blanc', category: 'Produit laitier', allergens: ['Lactose'] };
  mon.dishes[4] = { id: 'mon-d', name: 'Compote de pommes', category: 'Dessert', allergens: [] };
  return days;
}

function allergenMatches(dishAllergens: string[], childAllergy: string): boolean {
  const allergy = childAllergy.toLowerCase().trim();
  return dishAllergens.some((a) => {
    const al = a.toLowerCase().trim();
    return al === allergy || al.includes(allergy) || allergy.includes(al);
  });
}

function extractProtocolInstruction(protocol: string): string {
  const lower = protocol.toLowerCase();
  if (lower.includes('panier') || lower.includes('repas sans')) return 'Fournir panier repas';
  if (lower.includes('substitut') || lower.includes('dessert')) return 'Substituer le dessert';
  if (lower.includes('éviter') || lower.includes('eviter')) return 'Éviter le plat concerné';
  if (lower.includes('epipen') || lower.includes('injecter')) return 'Protocole urgence - EpiPen';
  return 'Consulter le protocole complet';
}

export function SanteTab() {
  const [subView, setSubView] = useState<SubView>('grid');
  const [careRecords, setCareRecords] = useState<CareRecord[]>(initialCareRecords.map((r) => ({
    ...r,
    boboType: 'Égratignure' as BoboType,
    animator: 'Sarah',
    parentsNotified: false,
    attachmentUrl: null,
  })));
  const [showCareForm, setShowCareForm] = useState(false);
  const [paiModalChild, setPaiModalChild] = useState<string | null>(null);
  const [weeklyMenu, setWeeklyMenu] = useState<DayMenu[]>(getDemoWeekMenu());
  const [activeDay, setActiveDay] = useState(0);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [showDocViewer, setShowDocViewer] = useState(false);
  const [docViewerUrl, setDocViewerUrl] = useState<string | null>(null);
  const [docViewerTitle, setDocViewerTitle] = useState('');
  const [ocrScanning, setOcrScanning] = useState(false);

  // PAI documents: childId -> document URL (object URL for demo)
  const [paiDocuments, setPaiDocuments] = useState<Record<string, string>>({});

  // PAI add form state
  const [showAddPai, setShowAddPai] = useState(false);
  const [paiChildSelect, setPaiChildSelect] = useState('');
  const [paiAllergy, setPaiAllergy] = useState('');
  const [paiProtocol, setPaiProtocol] = useState('');
  const [paiContact, setPaiContact] = useState('');
  const [paiPhone, setPaiPhone] = useState('');

  // Menu inline edit mode
  const [editMenuMode, setEditMenuMode] = useState(false);

  // Care form state
  const [formChild, setFormChild] = useState('');
  const [formBoboType, setFormBoboType] = useState<BoboType>('Chute');
  const [formDesc, setFormDesc] = useState('');
  const [formTreatment, setFormTreatment] = useState('');
  const [formAnimator, setFormAnimator] = useState('');
  const [formParentsNotified, setFormParentsNotified] = useState(false);
  const [formTime, setFormTime] = useState('');
  const [formAttachmentFile, setFormAttachmentFile] = useState<File | null>(null);
  const [formAttachmentName, setFormAttachmentName] = useState('');

  // Manual menu entry state
  const [manualDishes, setManualDishes] = useState<MenuDish[]>([]);

  const paiChildren = children.filter((c) => c.pai !== null);

  // ── PAI cross-reference logic ──
  const presentAtMidi = children.filter((c) => c.present.midi);
  const presentPaiChildren = presentAtMidi.filter((c) => c.pai !== null);
  const todayMenu = weeklyMenu[activeDay];
  const todayDishes = todayMenu?.dishes.filter((d) => d.name.trim() !== '') || [];

  const paiConflicts: { childName: string; classe: string; allergy: string; dishName: string; dishCategory: MenuCategory; protocol: string }[] = [];
  presentPaiChildren.forEach((child) => {
    todayDishes.forEach((dish) => {
      if (allergenMatches(dish.allergens, child.pai!.allergy)) {
        paiConflicts.push({
          childName: `${child.firstName} ${child.lastName}`,
          classe: child.classe,
          allergy: child.pai!.allergy,
          dishName: dish.name,
          dishCategory: dish.category,
          protocol: extractProtocolInstruction(child.pai!.protocol),
        });
      }
    });
  });

  const addCareRecord = () => {
    if (!formChild || !formDesc) return;
    const child = children.find((c) => c.id === formChild);
    if (!child) return;
    const timeStr = formTime.trim() || new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const newRecord: CareRecord = {
      id: `r${Date.now()}`,
      childId: formChild,
      childName: `${child.firstName} ${child.lastName}`,
      time: timeStr,
      description: formDesc,
      treatment: formTreatment,
      date: new Date().toISOString().split('T')[0],
      boboType: formBoboType,
      animator: formAnimator || 'Non précisé',
      parentsNotified: formParentsNotified,
      attachmentUrl: formAttachmentFile ? URL.createObjectURL(formAttachmentFile) : null,
    };
    setCareRecords([newRecord, ...careRecords]);
    setFormChild('');
    setFormBoboType('Chute');
    setFormDesc('');
    setFormTreatment('');
    setFormAnimator('');
    setFormParentsNotified(false);
    setFormTime('');
    setFormAttachmentFile(null);
    setFormAttachmentName('');
    setShowCareForm(false);
  };

  const handleManualEntrySave = () => {
    const updated = [...weeklyMenu];
    updated[activeDay] = { ...updated[activeDay], dishes: manualDishes };
    setWeeklyMenu(updated);
    setShowManualEntry(false);
  };

  const startManualEntry = () => {
    setManualDishes(todayDishes.length > 0
      ? [...todayDishes]
      : [
          { id: `m-e`, name: '', category: 'Entrée' as MenuCategory, allergens: [] },
          { id: `m-p`, name: '', category: 'Plat' as MenuCategory, allergens: [] },
          { id: `m-g`, name: '', category: 'Garniture' as MenuCategory, allergens: [] },
          { id: `m-l`, name: '', category: 'Produit laitier' as MenuCategory, allergens: [] },
          { id: `m-d`, name: '', category: 'Dessert' as MenuCategory, allergens: [] },
        ]);
    setShowManualEntry(true);
    setShowImportModal(false);
  };

  const handleMenuFileUpload = (file: File) => {
    setShowImportModal(false);
    setOcrScanning(true);
    // Simulate OCR analysis delay
    setTimeout(() => {
      const fileUrl = URL.createObjectURL(file);
      const updated = [...weeklyMenu];
      updated[activeDay] = {
        ...updated[activeDay],
        documentUrl: fileUrl,
        dishes: OCR_DEMO_DISHES.map((d) => ({ ...d, id: `${activeDay}-${d.id}` })),
      };
      setWeeklyMenu(updated);
      setOcrScanning(false);
    }, 2000);
  };

  const handlePaiDocUpload = (childId: string, file: File) => {
    const url = URL.createObjectURL(file);
    setPaiDocuments((prev) => ({ ...prev, [childId]: url }));
  };

  const openDocViewer = (url: string, title: string) => {
    setDocViewerUrl(url);
    setDocViewerTitle(title);
    setShowDocViewer(true);
  };

  if (subView !== 'grid') {
    return (
      <SubViewRenderer
        subView={subView}
        onBack={() => setSubView('grid')}
        paiChildren={paiChildren}
        paiModalChild={paiModalChild}
        setPaiModalChild={setPaiModalChild}
        careRecords={careRecords}
        showCareForm={showCareForm}
        setShowCareForm={setShowCareForm}
        formChild={formChild}
        setFormChild={setFormChild}
        formDesc={formDesc}
        setFormDesc={setFormDesc}
        formTreatment={formTreatment}
        setFormTreatment={setFormTreatment}
        formBoboType={formBoboType}
        setFormBoboType={setFormBoboType}
        formAnimator={formAnimator}
        setFormAnimator={setFormAnimator}
        formParentsNotified={formParentsNotified}
        setFormParentsNotified={setFormParentsNotified}
        formTime={formTime}
        setFormTime={setFormTime}
        formAttachmentFile={formAttachmentFile}
        setFormAttachmentFile={setFormAttachmentFile}
        formAttachmentName={formAttachmentName}
        setFormAttachmentName={setFormAttachmentName}
        addCareRecord={addCareRecord}
        weeklyMenu={weeklyMenu}
        setWeeklyMenu={setWeeklyMenu}
        activeDay={activeDay}
        setActiveDay={setActiveDay}
        showImportModal={showImportModal}
        setShowImportModal={setShowImportModal}
        showManualEntry={showManualEntry}
        setShowManualEntry={setShowManualEntry}
        manualDishes={manualDishes}
        setManualDishes={setManualDishes}
        startManualEntry={startManualEntry}
        handleManualEntrySave={handleManualEntrySave}
        handleMenuFileUpload={handleMenuFileUpload}
        ocrScanning={ocrScanning}
        paiConflicts={paiConflicts}
        presentPaiChildren={presentPaiChildren}
        todayDishes={todayDishes}
        paiDocuments={paiDocuments}
        handlePaiDocUpload={handlePaiDocUpload}
        openDocViewer={openDocViewer}
        showDocViewer={showDocViewer}
        setShowDocViewer={setShowDocViewer}
        docViewerUrl={docViewerUrl}
        docViewerTitle={docViewerTitle}
        showAddPai={showAddPai}
        setShowAddPai={setShowAddPai}
        paiChildSelect={paiChildSelect}
        setPaiChildSelect={setPaiChildSelect}
        paiAllergy={paiAllergy}
        setPaiAllergy={setPaiAllergy}
        paiProtocol={paiProtocol}
        setPaiProtocol={setPaiProtocol}
        paiContact={paiContact}
        setPaiContact={setPaiContact}
        paiPhone={paiPhone}
        setPaiPhone={setPaiPhone}
        editMenuMode={editMenuMode}
        setEditMenuMode={setEditMenuMode}
      />
    );
  }

  const tiles = [
    {
      key: 'pai' as SubView,
      title: 'Fiches PAI',
      subtitle: "Protocoles d'urgence",
      icon: HeartPulse,
      color: 'bg-rose-100',
      iconColor: 'text-rose-600',
      badge: paiChildren.length,
    },
    {
      key: 'registre' as SubView,
      title: 'Registre des soins',
      subtitle: 'Bobologie',
      icon: ClipboardList,
      color: 'bg-blue-100',
      iconColor: 'text-[#2563EB]',
      badge: careRecords.length,
    },
    {
      key: 'pharmacie' as SubView,
      title: 'Pharmacie',
      subtitle: 'Trousse de secours',
      icon: Pill,
      color: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
    },
    {
      key: 'menus' as SubView,
      title: 'Menus cantine',
      subtitle: 'Croisement PAI',
      icon: UtensilsCrossed,
      color: 'bg-amber-100',
      iconColor: 'text-amber-600',
      badge: paiConflicts.length > 0 ? paiConflicts.length : undefined,
    },
  ];

  return (
    <div className="min-h-screen bg-[#F1F5F9] pb-24">
      <div className="px-5 pt-4 pb-3">
        <h1 className="text-xl font-bold text-gray-900">Santé &amp; Bobologie</h1>
        <p className="text-sm text-gray-400">Gestion médicale et soins</p>
      </div>

      {/* Emergency call banner */}
      <div className="px-5 mt-4">
        <a
          href="tel:15"
          className="flex items-center gap-3 bg-red-50 border-2 border-red-200 rounded-2xl p-4 active:scale-[0.98] transition"
        >
          <div className="w-12 h-12 rounded-2xl bg-red-500 flex items-center justify-center animate-pulse-ring">
            <Phone size={22} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-red-800">Appel d'urgence - SAMU 15</p>
            <p className="text-xs text-red-600">Appel direct en cas d'urgence médicale</p>
          </div>
        </a>
      </div>

      {/* Cantine alert preview */}
      {paiConflicts.length > 0 && (
        <div className="px-5 mt-3">
          <button
            onClick={() => setSubView('menus')}
            className="w-full flex items-center gap-3 bg-red-50 border-2 border-red-300 rounded-2xl p-3.5 active:scale-[0.98] transition text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-red-500 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={20} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-red-800">Alerte Cantine : {paiConflicts.length} repas à risque aujourd'hui</p>
              <p className="text-xs text-red-600 mt-0.5">Touchez pour voir les détails</p>
            </div>
            <ChevronRight size={18} className="text-red-400" />
          </button>
        </div>
      )}

      {/* Grid of tiles */}
      <div className="px-5 mt-4">
        <div className="grid grid-cols-2 gap-3">
          {tiles.map(({ key, title, subtitle, icon: Icon, color, iconColor, badge }) => (
            <button
              key={key}
              onClick={() => setSubView(key)}
              className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50 flex flex-col items-start gap-3 active:scale-95 transition hover:shadow-md text-left"
            >
              <div className={`w-14 h-14 rounded-2xl ${color} flex items-center justify-center relative`}>
                <Icon size={26} className={iconColor} />
                {badge !== undefined && badge > 0 && (
                  <span className={`absolute -top-1 -right-1 w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center ${
                    key === 'menus' ? 'bg-red-500' : 'bg-[#2563EB]'
                  }`}>
                    {badge}
                  </span>
                )}
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">{title}</p>
                <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── SubView props ──
interface SubViewProps {
  subView: SubView;
  onBack: () => void;
  paiChildren: typeof children;
  paiModalChild: string | null;
  setPaiModalChild: (id: string | null) => void;
  careRecords: CareRecord[];
  showCareForm: boolean;
  setShowCareForm: (v: boolean) => void;
  formChild: string;
  setFormChild: (v: string) => void;
  formDesc: string;
  setFormDesc: (v: string) => void;
  formTreatment: string;
  setFormTreatment: (v: string) => void;
  formBoboType: BoboType;
  setFormBoboType: (v: BoboType) => void;
  formAnimator: string;
  setFormAnimator: (v: string) => void;
  formParentsNotified: boolean;
  setFormParentsNotified: (v: boolean) => void;
  formTime: string;
  setFormTime: (v: string) => void;
  formAttachmentFile: File | null;
  setFormAttachmentFile: (v: File | null) => void;
  formAttachmentName: string;
  setFormAttachmentName: (v: string) => void;
  addCareRecord: () => void;
  weeklyMenu: DayMenu[];
  setWeeklyMenu: (v: DayMenu[]) => void;
  activeDay: number;
  setActiveDay: (v: number) => void;
  showImportModal: boolean;
  setShowImportModal: (v: boolean) => void;
  showManualEntry: boolean;
  setShowManualEntry: (v: boolean) => void;
  manualDishes: MenuDish[];
  setManualDishes: (v: MenuDish[]) => void;
  startManualEntry: () => void;
  handleManualEntrySave: () => void;
  handleMenuFileUpload: (file: File) => void;
  ocrScanning: boolean;
  paiConflicts: { childName: string; classe: string; allergy: string; dishName: string; dishCategory: MenuCategory; protocol: string }[];
  presentPaiChildren: typeof children;
  todayDishes: MenuDish[];
  paiDocuments: Record<string, string>;
  handlePaiDocUpload: (childId: string, file: File) => void;
  openDocViewer: (url: string, title: string) => void;
  showDocViewer: boolean;
  setShowDocViewer: (v: boolean) => void;
  docViewerUrl: string | null;
  docViewerTitle: string;
  showAddPai: boolean;
  setShowAddPai: (v: boolean) => void;
  paiChildSelect: string;
  setPaiChildSelect: (v: string) => void;
  paiAllergy: string;
  setPaiAllergy: (v: string) => void;
  paiProtocol: string;
  setPaiProtocol: (v: string) => void;
  paiContact: string;
  setPaiContact: (v: string) => void;
  paiPhone: string;
  setPaiPhone: (v: string) => void;
  editMenuMode: boolean;
  setEditMenuMode: (v: boolean) => void;
}

function SubViewRenderer(props: SubViewProps) {
  const { subView, onBack } = props;

  return (
    <div className="min-h-screen bg-[#F1F5F9] pb-24">
      <div className="px-5 pt-4 pb-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-500 text-sm font-semibold mb-3"
        >
          <X size={18} />
          Retour
        </button>
        <h1 className="text-xl font-bold text-gray-900">
          {subView === 'pai' && 'Fiches PAI & Protocoles'}
          {subView === 'registre' && 'Registre des soins'}
          {subView === 'pharmacie' && 'Pharmacie & Trousse'}
          {subView === 'menus' && 'Menus de la cantine'}
        </h1>
      </div>

      {subView === 'pai' && <PaiView {...props} />}
      {subView === 'registre' && <RegistreView {...props} />}
      {subView === 'pharmacie' && <PharmacieView />}
      {subView === 'menus' && <MenusView {...props} />}

      {/* Shared document viewer modal */}
      <Modal open={props.showDocViewer} onClose={() => props.setShowDocViewer(false)} title={props.docViewerTitle}>
        <div className="space-y-4">
          {props.docViewerUrl && (
            <>
              {props.docViewerUrl.match(/\.(pdf)$/i) ? (
                <iframe src={props.docViewerUrl} className="w-full h-[60vh] rounded-2xl border border-gray-100" title={props.docViewerTitle} />
              ) : (
                <img src={props.docViewerUrl} alt={props.docViewerTitle} className="w-full rounded-2xl" />
              )}
              <a
                href={props.docViewerUrl}
                download={props.docViewerTitle}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#2563EB] text-white font-bold rounded-2xl active:scale-95 transition"
              >
                <Download size={18} />
                Télécharger le document
              </a>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}

// ── PAI View (enhanced with PDF documents) ──
function PaiView({ paiChildren, paiModalChild, setPaiModalChild, paiDocuments, handlePaiDocUpload, openDocViewer, showAddPai, setShowAddPai, paiChildSelect, setPaiChildSelect, paiAllergy, setPaiAllergy, paiProtocol, setPaiProtocol, paiContact, setPaiContact, paiPhone, setPaiPhone }: SubViewProps) {
  const selectedChild = paiChildren.find((c) => c.id === paiModalChild);

  const handleAddPai = () => {
    if (!paiChildSelect || !paiAllergy.trim()) return;
    const child = children.find((c) => c.id === paiChildSelect);
    if (!child) return;
    child.pai = {
      allergy: paiAllergy.trim(),
      protocol: paiProtocol.trim(),
      emergencyContact: paiContact.trim(),
      emergencyPhone: paiPhone.trim(),
    };
    setShowAddPai(false);
    setPaiChildSelect('');
    setPaiAllergy('');
    setPaiProtocol('');
    setPaiContact('');
    setPaiPhone('');
  };

  return (
    <div className="px-5 mt-4 space-y-3">
      <button
        onClick={() => setShowAddPai(true)}
        className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#2563EB] text-white font-bold rounded-2xl active:scale-95 transition shadow-md shadow-blue-200"
      >
        <Plus size={20} />
        Ajouter un protocole PAI
      </button>

      {paiChildren.map((child) => {
        const hasDoc = !!paiDocuments[child.id];
        return (
          <div key={child.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50">
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-bold ${getAvatarColor(child.firstName + child.lastName)}`}
              >
                {getInitials(child.firstName, child.lastName)}
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-900">
                  {child.firstName} {child.lastName}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-bold rounded-full">
                    {child.pai!.allergy}
                  </span>
                  {hasDoc && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full flex items-center gap-0.5">
                      <FileText size={10} />
                      PDF joint
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setPaiModalChild(child.id)}
                className="px-3 py-2 bg-[#2563EB] text-white text-xs font-bold rounded-xl active:scale-95 transition"
              >
                Voir protocole
              </button>
            </div>

            {/* PDF document section */}
            <div className="mt-3 pt-3 border-t border-gray-50">
              {hasDoc ? (
                <div className="space-y-2">
                  <button
                    onClick={() => openDocViewer(paiDocuments[child.id], `PAI - ${child.firstName} ${child.lastName}`)}
                    className="w-full flex items-center gap-2 py-2.5 px-3 bg-blue-50 text-blue-700 text-sm font-bold rounded-xl border border-blue-200 active:scale-95 transition"
                  >
                    <FileText size={18} />
                    Consulter l'ordonnance / protocole officiel (PDF)
                    <Maximize2 size={14} className="ml-auto" />
                  </button>
                  <label className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-gray-400 font-medium cursor-pointer hover:text-gray-600 transition">
                    <Upload size={12} />
                    Remplacer le document
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handlePaiDocUpload(child.id, f);
                      }}
                    />
                  </label>
                </div>
              ) : (
                <label className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-gray-50 text-gray-500 text-xs font-bold rounded-xl border border-dashed border-gray-200 cursor-pointer hover:bg-gray-100 transition">
                  <Upload size={14} />
                  Ajouter le document PAI (PDF)
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handlePaiDocUpload(child.id, f);
                    }}
                  />
                </label>
              )}
            </div>
          </div>
        );
      })}

      <Modal
        open={!!selectedChild}
        onClose={() => setPaiModalChild(null)}
        title={selectedChild ? `PAI - ${selectedChild.firstName} ${selectedChild.lastName}` : ''}
      >
        {selectedChild && (
          <div className="space-y-4">
            <div className="bg-orange-50 rounded-2xl p-4">
              <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide mb-1">Allergie</p>
              <p className="text-sm font-bold text-orange-800">{selectedChild.pai!.allergy}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Protocole d'urgence</p>
              <p className="text-sm text-gray-700 leading-relaxed">{selectedChild.pai!.protocol}</p>
            </div>
            <div className="bg-gray-50 rounded-2xl p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Contact d'urgence</p>
              <p className="text-sm font-bold text-gray-900">{selectedChild.pai!.emergencyContact}</p>
              <a
                href={`tel:${selectedChild.pai!.emergencyPhone.replace(/\s/g, '')}`}
                className="flex items-center gap-2 mt-2 text-[#2563EB] font-semibold text-sm"
              >
                <Phone size={16} />
                {selectedChild.pai!.emergencyPhone}
              </a>
            </div>
            {paiDocuments[selectedChild.id] && (
              <button
                onClick={() => openDocViewer(paiDocuments[selectedChild.id], `PAI - ${selectedChild.firstName} ${selectedChild.lastName}`)}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#2563EB] text-white font-bold rounded-2xl active:scale-95 transition"
              >
                <FileText size={18} />
                Consulter l'ordonnance / protocole officiel (PDF)
              </button>
            )}
            <a
              href="tel:15"
              className="flex items-center justify-center gap-2 w-full py-3.5 bg-red-500 text-white font-bold rounded-2xl active:scale-95 transition"
            >
              <Phone size={18} />
              Appeler le SAMU - 15
            </a>
          </div>
        )}
      </Modal>

      {/* Add PAI modal */}
      <Modal open={showAddPai} onClose={() => setShowAddPai(false)} title="Ajouter un protocole PAI">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Enfant concerné</label>
            <select
              value={paiChildSelect}
              onChange={(e) => setPaiChildSelect(e.target.value)}
              className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-sm font-medium text-gray-900 outline-none focus:ring-2 ring-blue-200"
            >
              <option value="">Sélectionner un enfant</option>
              {children.map((c) => (
                <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Allergie / Pathologie</label>
            <input
              value={paiAllergy}
              onChange={(e) => setPaiAllergy(e.target.value)}
              placeholder="Ex: Arachide, Lactose, Asthme..."
              className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-900 outline-none focus:ring-2 ring-blue-200"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Protocole d'urgence</label>
            <textarea
              value={paiProtocol}
              onChange={(e) => setPaiProtocol(e.target.value)}
              placeholder="Ex: Éviter tout contact avec arachide. En cas de réaction, administrer EpiPen..."
              rows={3}
              className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-900 outline-none focus:ring-2 ring-blue-200 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Contact d'urgence</label>
              <input
                value={paiContact}
                onChange={(e) => setPaiContact(e.target.value)}
                placeholder="Nom du contact"
                className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-900 outline-none focus:ring-2 ring-blue-200"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Téléphone</label>
              <input
                value={paiPhone}
                onChange={(e) => setPaiPhone(e.target.value)}
                placeholder="06 12 34 56 78"
                className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-900 outline-none focus:ring-2 ring-blue-200"
              />
            </div>
          </div>
          <button
            onClick={handleAddPai}
            disabled={!paiChildSelect || !paiAllergy.trim()}
            className="w-full py-3.5 bg-[#2563EB] text-white font-bold rounded-2xl active:scale-95 transition disabled:opacity-40 shadow-md shadow-blue-200"
          >
            Enregistrer le protocole PAI
          </button>
        </div>
      </Modal>
    </div>
  );
}

// ── Registre View (enhanced with attachments) ──
function RegistreView({
  careRecords,
  showCareForm,
  setShowCareForm,
  formChild,
  setFormChild,
  formDesc,
  setFormDesc,
  formTreatment,
  setFormTreatment,
  formBoboType,
  setFormBoboType,
  formAnimator,
  setFormAnimator,
  formParentsNotified,
  setFormParentsNotified,
  formTime,
  setFormTime,
  formAttachmentFile,
  setFormAttachmentFile,
  formAttachmentName,
  setFormAttachmentName,
  addCareRecord,
  openDocViewer,
}: SubViewProps) {
  const sortedRecords = [...careRecords].sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date);
    if (dateCompare !== 0) return dateCompare;
    return b.time.localeCompare(a.time);
  });

  return (
    <div className="px-5 mt-4">
      <button
        onClick={() => setShowCareForm(true)}
        className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#2563EB] text-white font-bold rounded-2xl active:scale-95 transition mb-4 shadow-md shadow-blue-200"
      >
        <Plus size={20} />
        Déclarer un soin
      </button>

      <div className="space-y-3">
        {sortedRecords.map((record) => (
          <div key={record.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Clock size={18} className="text-[#2563EB]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-gray-900">{record.childName}</p>
                  <div className="flex items-center gap-1.5">
                    {record.attachmentUrl && (
                      <button
                        onClick={() => openDocViewer(record.attachmentUrl!, `Justificatif - ${record.childName}`)}
                        className="p-1.5 rounded-lg bg-blue-50 text-[#2563EB] active:scale-90 transition"
                        title="Voir le justificatif"
                      >
                        <Paperclip size={14} />
                      </button>
                    )}
                    <span className="text-xs text-gray-400">{record.time}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="px-2 py-0.5 bg-blue-50 text-[#2563EB] text-[10px] font-bold rounded-full">
                    {record.boboType}
                  </span>
                  {record.parentsNotified && (
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-full flex items-center gap-0.5">
                      <Check size={10} />
                      Parents prévenus
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-1.5">{record.description}</p>
                <div className="mt-2 flex items-start gap-1.5 bg-emerald-50 rounded-xl px-3 py-2">
                  <Check size={14} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-emerald-700">{record.treatment}</p>
                </div>
                <div className="flex items-center gap-1.5 mt-2">
                  <User size={12} className="text-gray-300" />
                  <p className="text-xs text-gray-400">Intervenant : {record.animator}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={showCareForm}
        onClose={() => setShowCareForm(false)}
        title="Déclarer un soin"
      >
        <div className="space-y-4">
          {/* Enfant */}
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Enfant concerné</label>
            <select
              value={formChild}
              onChange={(e) => setFormChild(e.target.value)}
              className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-sm font-medium text-gray-900 outline-none focus:ring-2 ring-blue-200"
            >
              <option value="">Sélectionner un enfant</option>
              {children.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName}
                </option>
              ))}
            </select>
          </div>

          {/* Heure */}
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Heure du soin</label>
            <input
              type="time"
              value={formTime}
              onChange={(e) => setFormTime(e.target.value)}
              className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-sm font-medium text-gray-900 outline-none focus:ring-2 ring-blue-200"
            />
          </div>

          {/* Type de bobo */}
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Type de bobo</label>
            <div className="flex gap-2 flex-wrap mt-2">
              {BOBO_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => setFormBoboType(type)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition ${
                    formBoboType === type
                      ? 'bg-[#2563EB] text-white'
                      : 'bg-gray-50 text-gray-500 border border-gray-100'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Description</label>
            <textarea
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              placeholder="Ex: Éraflure au genou gauche dans la cour..."
              rows={3}
              className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-900 outline-none focus:ring-2 ring-blue-200 resize-none"
            />
          </div>

          {/* Soin appliqué */}
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Soin appliqué</label>
            <textarea
              value={formTreatment}
              onChange={(e) => setFormTreatment(e.target.value)}
              placeholder="Ex: Nettoyage au sérum physiologique, pansement adhésif..."
              rows={2}
              className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-900 outline-none focus:ring-2 ring-blue-200 resize-none"
            />
          </div>

          {/* Animateur intervenant */}
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Animateur intervenant</label>
            <select
              value={formAnimator}
              onChange={(e) => setFormAnimator(e.target.value)}
              className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-sm font-medium text-gray-900 outline-none focus:ring-2 ring-blue-200"
            >
              <option value="">Sélectionner un animateur</option>
              {animators.map((a) => (
                <option key={a.id} value={a.firstName}>
                  {a.firstName}
                </option>
              ))}
            </select>
          </div>

          {/* Parents prévenus */}
          <button
            onClick={() => setFormParentsNotified(!formParentsNotified)}
            className={`w-full flex items-center justify-between gap-3 py-3 px-4 rounded-2xl border-2 transition active:scale-[0.98] ${
              formParentsNotified
                ? 'bg-emerald-50 border-emerald-200'
                : 'bg-gray-50 border-gray-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                formParentsNotified ? 'bg-emerald-500' : 'bg-gray-200'
              }`}>
                <Phone size={18} className={formParentsNotified ? 'text-white' : 'text-gray-400'} />
              </div>
              <div className="text-left">
                <p className={`text-sm font-bold ${formParentsNotified ? 'text-emerald-800' : 'text-gray-500'}`}>
                  Parents prévenus par téléphone
                </p>
                <p className="text-xs text-gray-400">
                  {formParentsNotified ? 'Oui, appel effectué' : 'Non, à appeler'}
                </p>
              </div>
            </div>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center transition ${
              formParentsNotified ? 'bg-emerald-500' : 'bg-gray-200'
            }`}>
              <Check size={16} className={formParentsNotified ? 'text-white' : 'text-transparent'} strokeWidth={3} />
            </div>
          </button>

          {/* Attachment with photo capture + thumbnail preview */}
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Justificatif (optionnel)</label>
            {formAttachmentFile ? (
              <div className="mt-1 space-y-2">
                {formAttachmentFile.type.startsWith('image/') ? (
                  <button
                    type="button"
                    onClick={() => openDocViewer(URL.createObjectURL(formAttachmentFile), formAttachmentName)}
                    className="block w-full rounded-xl overflow-hidden border border-blue-200 active:scale-[0.98] transition"
                  >
                    <img
                      src={URL.createObjectURL(formAttachmentFile)}
                      alt={formAttachmentName}
                      className="w-full max-h-48 object-cover"
                    />
                    <div className="flex items-center justify-between gap-2 py-2 px-3 bg-blue-50">
                      <span className="text-xs text-blue-700 font-medium truncate flex items-center gap-1.5">
                        <Paperclip size={14} className="flex-shrink-0" />
                        {formAttachmentName}
                      </span>
                      <span className="text-xs text-blue-500 font-bold flex items-center gap-1">
                        <Maximize2 size={12} />
                        Agrandir
                      </span>
                    </div>
                  </button>
                ) : (
                  <div className="flex items-center justify-between gap-2 py-3 px-4 bg-blue-50 rounded-xl border border-blue-200">
                    <div className="flex items-center gap-2 text-sm text-blue-700 font-medium min-w-0">
                      <Paperclip size={16} className="flex-shrink-0" />
                      <span className="truncate">{formAttachmentName}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => openDocViewer(URL.createObjectURL(formAttachmentFile), formAttachmentName)}
                      className="p-1.5 bg-blue-100 rounded-lg text-blue-500 active:scale-90 transition flex-shrink-0"
                    >
                      <Maximize2 size={16} />
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => { setFormAttachmentFile(null); setFormAttachmentName(''); }}
                  className="w-full flex items-center justify-center gap-1.5 py-2 bg-rose-50 text-rose-600 text-xs font-bold rounded-xl active:scale-95 transition"
                >
                  <XCircle size={14} />
                  Retirer la pièce jointe
                </button>
              </div>
            ) : (
              <div className="mt-1 grid grid-cols-2 gap-2">
                <label className="flex flex-col items-center justify-center gap-1.5 py-3.5 bg-gray-50 rounded-xl text-xs text-gray-500 border border-dashed border-gray-200 cursor-pointer hover:bg-gray-100 transition">
                  <Camera size={18} className="text-gray-400" />
                  Prendre une photo
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setFormAttachmentFile(f);
                        setFormAttachmentName(f.name);
                      }
                    }}
                  />
                </label>
                <label className="flex flex-col items-center justify-center gap-1.5 py-3.5 bg-gray-50 rounded-xl text-xs text-gray-500 border border-dashed border-gray-200 cursor-pointer hover:bg-gray-100 transition">
                  <Paperclip size={18} className="text-gray-400" />
                  Fichier (PDF / Photo)
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setFormAttachmentFile(f);
                        setFormAttachmentName(f.name);
                      }
                    }}
                  />
                </label>
              </div>
            )}
          </div>

          <button
            onClick={addCareRecord}
            disabled={!formChild || !formDesc}
            className="w-full py-3.5 bg-[#2563EB] text-white font-bold rounded-2xl active:scale-95 transition disabled:opacity-40 shadow-md shadow-blue-200"
          >
            Enregistrer le soin
          </button>
        </div>
      </Modal>
    </div>
  );
}

// ── Pharmacie View (barcode scan + full CRUD) ──
function PharmacieView() {
  const { activeCentre } = useAuth();
  const centreNom = activeCentre?.name || '';
  const [items, setItems] = useState<Array<{ id: string; nom: string; quantite: string; statut: string; code_barres: string | null; date_peremption: string | null; centre_nom: string; }>>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<{ stop: () => void } | null>(null);

  // Form state
  const [formNom, setFormNom] = useState('');
  const [formQuantite, setFormQuantite] = useState('');
  const [formStatut, setFormStatut] = useState('ok');
  const [formCodeBarres, setFormCodeBarres] = useState('');
  const [formPeremption, setFormPeremption] = useState('');
  const [saving, setSaving] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // Load items from DB
  useEffect(() => {
    if (!centreNom) return;
    const loadItems = async () => {
      const { data } = await supabase.from('pharmacie_items').select('*').eq('centre_nom', centreNom).order('nom');
      if (data) setItems(data as typeof items);
      setLoading(false);
    };
    loadItems();

    const channel = supabase
      .channel('pharmacie-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pharmacie_items', filter: 'centre_nom=eq.' + centreNom }, () => loadItems())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [centreNom]);

  const startScan = async () => {
    setScanError(null);
    setScanning(true);
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current!, (result) => {
        if (result) {
          const code = result.getText();
          stopScan();
          // Check if product exists
          const existing = items.find((i) => i.code_barres === code);
          if (existing) {
            setEditId(existing.id);
            setFormNom(existing.nom);
            setFormQuantite(existing.quantite);
            setFormStatut(existing.statut);
            setFormCodeBarres(existing.code_barres || '');
            setFormPeremption(existing.date_peremption || '');
            setShowAddForm(true);
          } else {
            setFormCodeBarres(code);
            setFormNom('');
            setFormQuantite('');
            setFormStatut('ok');
            setFormPeremption('');
            setEditId(null);
            setShowAddForm(true);
          }
        }
      });
      readerRef.current = controls;
    } catch {
      setScanError('Caméra indisponible. Saisie manuelle disponible.');
      setScanning(false);
    }
  };

  const stopScan = () => {
    if (readerRef.current) {
      readerRef.current.stop();
      readerRef.current = null;
    }
    setScanning(false);
  };

  const handleSave = async () => {
    if (!formNom.trim() || !centreNom) return;
    setSaving(true);
    const payload = {
      centre_nom: centreNom,
      nom: formNom.trim(),
      quantite: formQuantite.trim(),
      statut: formStatut,
      code_barres: formCodeBarres.trim() || null,
      date_peremption: formPeremption || null,
      updated_at: new Date().toISOString(),
    };
    if (editId) {
      await supabase.from('pharmacie_items').update(payload).eq('id', editId);
    } else {
      await supabase.from('pharmacie_items').insert(payload);
    }
    setSaving(false);
    setShowAddForm(false);
    setFormNom('');
    setFormQuantite('');
    setFormStatut('ok');
    setFormCodeBarres('');
    setFormPeremption('');
    setEditId(null);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('pharmacie_items').delete().eq('id', id);
  };

  const startEdit = (item: typeof items[0]) => {
    setEditId(item.id);
    setFormNom(item.nom);
    setFormQuantite(item.quantite);
    setFormStatut(item.statut);
    setFormCodeBarres(item.code_barres || '');
    setFormPeremption(item.date_peremption || '');
    setShowAddForm(true);
  };

  const startAddManual = () => {
    setEditId(null);
    setFormNom('');
    setFormQuantite('');
    setFormStatut('ok');
    setFormCodeBarres('');
    setFormPeremption('');
    setShowAddForm(true);
  };

  return (
    <div className="px-5 mt-4 space-y-3">
      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={scanning ? stopScan : startScan}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#2563EB] text-white text-sm font-bold rounded-2xl active:scale-95 transition shadow-md shadow-blue-200"
        >
          {scanning ? <Loader2 size={18} className="animate-spin" /> : <Barcode size={18} />}
          {scanning ? 'Arrêter le scan' : 'Scanner un produit'}
        </button>
        <button
          onClick={startAddManual}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-white text-[#2563EB] text-sm font-bold rounded-2xl active:scale-95 transition border-2 border-blue-200"
        >
          <Plus size={18} />
          Ajouter manuellement
        </button>
      </div>

      {/* Scanner video preview */}
      {scanning && (
        <div className="bg-black rounded-2xl overflow-hidden relative">
          <video ref={videoRef} className="w-full max-h-64 object-cover" />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-48 h-32 border-2 border-white/60 rounded-xl" />
          </div>
          <p className="text-white text-xs text-center py-2 bg-black/50">Visez le code-barres du produit</p>
        </div>
      )}
      {scanError && (
        <div className="flex items-center gap-2 p-3 rounded-xl text-xs font-semibold bg-amber-50 text-amber-600 border border-amber-200">
          <AlertTriangle size={14} />
          {scanError}
        </div>
      )}

      {/* Items list */}
      {loading ? (
        <div className="text-center py-8 text-gray-400">
          <Loader2 size={24} className="mx-auto mb-2 animate-spin" />
          <p className="text-sm">Chargement de l'inventaire...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <Pill size={32} className="mx-auto mb-2 text-gray-300" />
          <p className="text-sm">Aucun produit dans la trousse</p>
        </div>
      ) : (
        items.map((item) => (
          <div key={item.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">{item.nom}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <p className="text-xs text-gray-400">{item.quantite}</p>
                  {item.code_barres && (
                    <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[9px] font-bold rounded-full flex items-center gap-0.5">
                      <Barcode size={8} />
                      {item.code_barres}
                    </span>
                  )}
                  {item.date_peremption && (
                    <span className="text-xs text-gray-400">Péremption: {new Date(item.date_peremption).toLocaleDateString('fr-FR')}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${item.statut === 'ok' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                  {item.statut === 'ok' ? 'Stock OK' : 'À recharger'}
                </span>
                <button onClick={() => startEdit(item)} className="p-2 rounded-xl bg-blue-50 text-blue-500 active:scale-90 transition">
                  <Pencil size={14} />
                </button>
                <button onClick={() => handleDelete(item.id)} className="p-2 rounded-xl bg-rose-50 text-rose-500 active:scale-90 transition">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))
      )}

      {/* Add/Edit form modal */}
      <Modal open={showAddForm} onClose={() => { setShowAddForm(false); setEditId(null); }} title={editId ? 'Modifier le produit' : 'Nouveau produit'}>
        <div className="space-y-4">
          {formCodeBarres && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-xl border border-blue-200">
              <Barcode size={16} className="text-blue-600" />
              <span className="text-xs font-bold text-blue-700">Code-barres: {formCodeBarres}</span>
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Nom du produit</label>
            <input
              value={formNom}
              onChange={(e) => setFormNom(e.target.value)}
              placeholder="Ex: Pansements adhésifs"
              className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-900 outline-none focus:ring-2 ring-blue-200"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Quantité</label>
            <input
              value={formQuantite}
              onChange={(e) => setFormQuantite(e.target.value)}
              placeholder="Ex: Boîte de 50, 12 unidoses..."
              className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-900 outline-none focus:ring-2 ring-blue-200"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Statut</label>
            <div className="flex gap-2 mt-1">
              <button onClick={() => setFormStatut('ok')} className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition ${formStatut === 'ok' ? 'bg-emerald-500 text-white' : 'bg-gray-50 text-gray-500 border border-gray-100'}`}>
                Stock OK
              </button>
              <button onClick={() => setFormStatut('low')} className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition ${formStatut === 'low' ? 'bg-orange-500 text-white' : 'bg-gray-50 text-gray-500 border border-gray-100'}`}>
                À recharger
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Code-barres (optionnel)</label>
            <input
              value={formCodeBarres}
              onChange={(e) => setFormCodeBarres(e.target.value)}
              placeholder="Saisie manuelle ou scan automatique"
              className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-900 outline-none focus:ring-2 ring-blue-200"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Date de péremption (optionnel)</label>
            <input
              type="date"
              value={formPeremption}
              onChange={(e) => setFormPeremption(e.target.value)}
              className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-900 outline-none focus:ring-2 ring-blue-200"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !formNom.trim()}
            className="w-full py-3.5 bg-[#2563EB] text-white font-bold rounded-2xl active:scale-95 transition disabled:opacity-40 shadow-md shadow-blue-200 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
            {editId ? 'Enregistrer les modifications' : 'Ajouter le produit'}
          </button>
        </div>
      </Modal>
    </div>
  );
}

// ── Menus View (enhanced with PDF viewer + OCR) ──
function MenusView({
  weeklyMenu,
  setWeeklyMenu,
  activeDay,
  setActiveDay,
  showImportModal,
  setShowImportModal,
  showManualEntry,
  setShowManualEntry,
  manualDishes,
  setManualDishes,
  startManualEntry,
  handleManualEntrySave,
  handleMenuFileUpload,
  ocrScanning,
  paiConflicts,
  presentPaiChildren,
  todayDishes,
  openDocViewer,
  editMenuMode,
  setEditMenuMode,
}: SubViewProps) {
  const todayMenu = weeklyMenu[activeDay];
  const [inlineDishes, setInlineDishes] = useState<MenuDish[]>([]);

  const startInlineEdit = () => {
    setInlineDishes(todayDishes.length > 0 ? [...todayDishes] : [
      { id: 'ie', name: '', category: 'Entrée' as MenuCategory, allergens: [] },
      { id: 'ip', name: '', category: 'Plat' as MenuCategory, allergens: [] },
      { id: 'ig', name: '', category: 'Garniture' as MenuCategory, allergens: [] },
      { id: 'il', name: '', category: 'Produit laitier' as MenuCategory, allergens: [] },
      { id: 'id', name: '', category: 'Dessert' as MenuCategory, allergens: [] },
    ]);
    setEditMenuMode(true);
  };

  const saveInlineEdit = () => {
    const updated = [...weeklyMenu];
    updated[activeDay] = { ...updated[activeDay], dishes: inlineDishes };
    setWeeklyMenu(updated);
    setEditMenuMode(false);
  };
  const hasDoc = !!todayMenu?.documentUrl;

  return (
    <div className="px-5 mt-4 space-y-4">
      {/* OCR scanning overlay */}
      {ocrScanning && (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-6 flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#2563EB] flex items-center justify-center">
            <ScanLine size={24} className="text-white animate-pulse" />
          </div>
          <p className="text-sm font-bold text-blue-700">Analyse OCR du document en cours...</p>
          <p className="text-xs text-blue-500">Extraction des plats et allergènes détectés</p>
        </div>
      )}

      {/* ── PAI cross-reference alert banner ── */}
      {paiConflicts.length > 0 ? (
        <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center">
              <AlertTriangle size={16} className="text-white" />
            </div>
            <p className="text-sm font-bold text-red-800">
              Alerte Cantine : {paiConflicts.length} repas à risque aujourd'hui
            </p>
          </div>
          <div className="space-y-2">
            {paiConflicts.map((conflict, i) => (
              <div key={i} className="bg-white rounded-xl p-3 border border-red-100">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-xs font-bold text-red-600">
                    {conflict.childName.split(' ').map((n) => n[0]).join('')}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-gray-900">{conflict.childName}</p>
                    <p className="text-xs text-gray-400">{conflict.classe}</p>
                  </div>
                  <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded-full">
                    {conflict.allergy}
                  </span>
                </div>
                <div className="flex items-center gap-2 bg-red-50 rounded-lg px-3 py-2 mb-2">
                  <UtensilsCrossed size={14} className="text-red-500 flex-shrink-0" />
                  <p className="text-xs text-red-700">
                    <span className="font-bold">{conflict.dishCategory}:</span> {conflict.dishName}
                  </p>
                </div>
                <div className="flex items-center gap-2 bg-amber-50 rounded-lg px-3 py-2">
                  <ClipboardList size={14} className="text-amber-500 flex-shrink-0" />
                  <p className="text-xs text-amber-700 font-medium">
                    Consigne : {conflict.protocol}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-4">
          <div className="flex items-center gap-2">
            <Check size={18} className="text-emerald-600" />
            <p className="text-sm font-bold text-emerald-800">Aucun repas à risque détecté aujourd'hui</p>
          </div>
          <p className="text-xs text-emerald-600 mt-1">
            {presentPaiChildren.length} enfant(s) PAI présent(s) à midi — aucun conflit avec le menu.
          </p>
        </div>
      )}

      {/* ── Day selector ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Calendar size={16} className="text-blue-500" />
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Menu de la semaine</p>
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {weeklyMenu.map((dayMenu, i) => {
            const hasDishes = dayMenu.dishes.some((d) => d.name.trim() !== '');
            const hasFile = !!dayMenu.documentUrl;
            return (
              <button
                key={i}
                onClick={() => setActiveDay(i)}
                className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all relative ${
                  activeDay === i
                    ? 'bg-[#2563EB] text-white shadow-md'
                    : hasDishes || hasFile
                    ? 'bg-white text-gray-700 border border-gray-100'
                    : 'bg-white text-gray-300 border border-gray-50'
                }`}
              >
                {dayMenu.day}
                {hasFile && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-400 flex items-center justify-center">
                    <FileText size={8} className="text-white" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Document viewer (if file uploaded) ── */}
      {hasDoc && !ocrScanning && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
              <FileText size={20} className="text-rose-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-900">Document du menu</p>
              <p className="text-xs text-gray-400">Menu importé pour le {todayMenu?.day}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => openDocViewer(todayMenu!.documentUrl!, `Menu - ${todayMenu!.day}`)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-50 text-[#2563EB] text-xs font-bold rounded-xl border border-blue-200 active:scale-95 transition"
            >
              <Maximize2 size={14} />
              Agrandir
            </button>
            <a
              href={todayMenu!.documentUrl!}
              download={`Menu-${todayMenu!.day}`}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-gray-50 text-gray-600 text-xs font-bold rounded-xl border border-gray-200 active:scale-95 transition"
            >
              <Download size={14} />
              Télécharger
            </a>
          </div>
        </div>
      )}

      {/* ── Today's menu ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Menu du {weeklyMenu[activeDay]?.day}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-600 text-xs font-bold rounded-xl border border-amber-200 active:scale-95 transition"
            >
              <Upload size={14} />
              Importer
            </button>
            {!editMenuMode ? (
              <button
                onClick={startInlineEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-[#2563EB] text-xs font-bold rounded-xl border border-blue-200 active:scale-95 transition"
              >
                <Pencil size={14} />
                Éditer
              </button>
            ) : (
              <button
                onClick={saveInlineEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 text-xs font-bold rounded-xl border border-emerald-200 active:scale-95 transition"
              >
                <Check size={14} />
                Valider
              </button>
            )}
          </div>
        </div>

        {editMenuMode ? (
          <div className="space-y-2.5">
            {inlineDishes.map((dish, i) => {
              const Icon = CATEGORY_ICONS[dish.category];
              return (
                <div key={dish.id} className="bg-white rounded-2xl p-3 shadow-sm border border-blue-100 flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                    <Icon size={16} className="text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-gray-400 font-medium uppercase">{dish.category}</p>
                    <input
                      value={dish.name}
                      onChange={(e) => {
                        const updated = [...inlineDishes];
                        updated[i] = { ...dish, name: e.target.value };
                        setInlineDishes(updated);
                      }}
                      placeholder={`Nom du plat...`}
                      className="w-full mt-0.5 px-2 py-1.5 bg-gray-50 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 ring-blue-200"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : todayDishes.length > 0 ? (
          <div className="space-y-2.5">
            {todayDishes.map((dish) => {
              const Icon = CATEGORY_ICONS[dish.category];
              const hasConflict = paiConflicts.some((c) => c.dishName === dish.name);
              return (
                <div
                  key={dish.id}
                  className={`bg-white rounded-2xl p-4 shadow-sm border flex items-center gap-3 ${
                    hasConflict ? 'border-red-200' : 'border-gray-50'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    hasConflict ? 'bg-red-100' : 'bg-amber-50'
                  }`}>
                    <Icon size={18} className={hasConflict ? 'text-red-500' : 'text-amber-600'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400 font-medium">{dish.category}</p>
                    <p className="text-sm font-bold text-gray-900">{dish.name}</p>
                    {dish.allergens.length > 0 && (
                      <div className="flex gap-1.5 mt-1 flex-wrap">
                        {dish.allergens.map((a) => (
                          <span key={a} className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                            hasConflict ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {a}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {hasConflict && (
                    <span className="px-2 py-1 bg-red-100 text-red-700 text-[10px] font-bold rounded-full flex items-center gap-1 flex-shrink-0">
                      <AlertTriangle size={10} />
                      Conflit PAI
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          !ocrScanning && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-50 text-center">
              <UtensilsCrossed size={32} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Aucun menu saisi pour ce jour</p>
              <button
                onClick={startInlineEdit}
                className="mt-3 text-xs text-[#2563EB] font-semibold"
              >
                Saisir le menu
              </button>
            </div>
          )
        )}
      </div>

      {/* ── Import modal ── */}
      <Modal open={showImportModal} onClose={() => setShowImportModal(false)} title="Importer le menu">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Choisissez comment importer le menu de la cantine pour le {weeklyMenu[activeDay]?.day}.
          </p>

          {/* File upload */}
          <label className="w-full flex items-center gap-3 py-4 px-4 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 cursor-pointer hover:bg-gray-100 transition active:scale-[0.98]">
            <div className="w-12 h-12 rounded-xl bg-rose-100 flex items-center justify-center">
              <FileText size={24} className="text-rose-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-900">Charger un fichier</p>
              <p className="text-xs text-gray-400">PDF ou photo du menu prestataire</p>
              <p className="text-[10px] text-blue-500 mt-1">Analyse OCR auto + pré-remplissage des plats</p>
            </div>
            <ChevronRight size={18} className="text-gray-300" />
            <input
              type="file"
              accept=".pdf,image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleMenuFileUpload(f);
              }}
            />
          </label>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-300 font-medium">ou</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          {/* Manual entry */}
          <button
            onClick={startManualEntry}
            className="w-full flex items-center gap-3 py-4 px-4 bg-blue-50 rounded-2xl border-2 border-blue-200 cursor-pointer hover:bg-blue-100 transition active:scale-[0.98]"
          >
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
              <UtensilsCrossed size={24} className="text-[#2563EB]" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-bold text-blue-800">Saisir manuellement les plats</p>
              <p className="text-xs text-blue-500">Entrée, plat, garniture, produit laitier, dessert</p>
            </div>
            <ChevronRight size={18} className="text-blue-300" />
          </button>
        </div>
      </Modal>

      {/* ── Manual entry modal ── */}
      <Modal open={showManualEntry} onClose={() => setShowManualEntry(false)} title={`Saisir le menu - ${weeklyMenu[activeDay]?.day}`}>
        <div className="space-y-4">
          {manualDishes.map((dish, i) => {
            const Icon = CATEGORY_ICONS[dish.category];
            return (
              <div key={dish.id}>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                  <Icon size={12} />
                  {dish.category}
                </label>
                <input
                  value={dish.name}
                  onChange={(e) => {
                    const updated = [...manualDishes];
                    updated[i] = { ...dish, name: e.target.value };
                    setManualDishes(updated);
                  }}
                  placeholder={`Nom du plat (${dish.category.toLowerCase()})`}
                  className="w-full mt-1 px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-900 outline-none focus:ring-2 ring-blue-200"
                />
                {/* Allergen chips */}
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {ALL_ALLERGENS.map((a) => {
                    const selected = dish.allergens.includes(a);
                    return (
                      <button
                        key={a}
                        onClick={() => {
                          const updated = [...manualDishes];
                          if (selected) {
                            updated[i] = { ...dish, allergens: dish.allergens.filter((x) => x !== a) };
                          } else {
                            updated[i] = { ...dish, allergens: [...dish.allergens, a] };
                          }
                          setManualDishes(updated);
                        }}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition ${
                          selected
                            ? 'bg-red-100 text-red-700 border border-red-200'
                            : 'bg-gray-50 text-gray-400 border border-gray-100'
                        }`}
                      >
                        {a}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <button
            onClick={handleManualEntrySave}
            className="w-full py-3.5 bg-[#2563EB] text-white font-bold rounded-2xl active:scale-95 transition shadow-md shadow-blue-200"
          >
            Enregistrer le menu
          </button>
        </div>
      </Modal>
    </div>
  );
}
