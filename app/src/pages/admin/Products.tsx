import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NavLink } from 'react-router-dom';
import { productService } from '@/services/products';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Search,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Package,
  AlertTriangle,
  Filter,
  Download,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Product } from '@/types';

// ── Tipe untuk satu baris preview import ──────────────────────────────────────
interface ImportRow {
  row: number;
  name: string;
  sku: string;
  description?: string;
  category_name?: string;
  pcs_per_pack: number;
  pack_per_karton: number;
  stock_karton: number;
  reorder_level: number;
  weight_gram?: number;
  price_reseller: number;
  price_agent: number;
  image_url?: string;        // kolom L — URL Cloudinary/gambar
  valid: boolean;
  errors: string[];
}

// ── Parse CSV sederhana (handle quoted fields) ────────────────────────────────
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQuotes = !inQuotes; }
    else if (c === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
    else current += c;
  }
  result.push(current.trim());
  return result;
}

// ── Parse file Excel/CSV → array ImportRow ────────────────────────────────────
async function parseImportFile(file: File): Promise<ImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) { resolve([]); return; }
        // Skip header row
        const rows: ImportRow[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = parseCSVLine(lines[i]);
          if (cols.length < 2 || !cols[0]) continue;
          const errors: string[] = [];
          const name          = cols[0] || '';
          const sku           = cols[1] || '';
          const description   = cols[2] || '';
          const category_name = cols[3] || '';
          const pcs_per_pack  = parseInt(cols[4]) || 0;
          const pack_per_karton = parseInt(cols[5]) || 0;
          const stock_karton  = parseInt(cols[6]) || 0;
          const reorder_level = parseInt(cols[7]) || 0;
          const weight_gram   = parseInt(cols[8]) || undefined;
          const price_reseller = parseFloat(String(cols[9]).replace(/[^0-9.]/g, '')) || 0;
          const price_agent    = parseFloat(String(cols[10]).replace(/[^0-9.]/g, '')) || 0;
          // Kolom L (index 11) — URL foto Cloudinary, opsional
          const raw_image_url  = (cols[11] || '').trim();
          let image_url: string | undefined;
          if (raw_image_url) {
            try {
              const u = new URL(raw_image_url);
              if (u.protocol === 'https:' || u.protocol === 'http:') {
                image_url = raw_image_url;
              } else {
                errors.push('URL foto tidak valid (harus https:// atau http://)');
              }
            } catch {
              errors.push('URL foto tidak valid');
            }
          }
          if (!name)    errors.push('Nama produk wajib diisi');
          if (!sku)     errors.push('SKU wajib diisi');
          if (!price_reseller) errors.push('Harga Reseller wajib diisi');
          if (pack_per_karton <= 0) errors.push('Pack/karton harus > 0');
          rows.push({ row: i + 1, name, sku, description, category_name, pcs_per_pack, pack_per_karton, stock_karton, reorder_level, weight_gram, price_reseller, price_agent, image_url, valid: errors.length === 0, errors });
        }
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsText(file, 'UTF-8');
  });
}

// ── Download template CSV ─────────────────────────────────────────────────────
function downloadTemplate() {
  const headers = [
    'Nama Produk*', 'SKU*', 'Deskripsi', 'Kategori',
    'Pcs/Pack', 'Pack/Karton*', 'Stok Karton', 'Reorder Level',
    'Berat (gram)', 'Harga Reseller*', 'Harga Agent', 'URL Foto (Cloudinary)',
  ];
  const examples = [
    ['Chitato Sapi 80g', 'CHIT-SAPI-80', 'Keripik kentang rasa sapi', 'Snack',
     '10', '12', '50', '10', '850', '85000', '78000',
     'https://res.cloudinary.com/your-cloud/image/upload/v1/snackhub/products/chitato-sapi.jpg'],
    ['Taro Net 140g', 'TARO-NET-140', 'Snack kentang rasa ayam panggang', 'Snack',
     '10', '12', '30', '5', '1200', '95000', '87000', ''],
  ];
  const csvContent = [headers, ...examples]
    .map(row => row.map(v => `"${v}"`).join(','))
    .join('\n');
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'template_import_produk.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export default function Products() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showLowStock, setShowLowStock] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // ── Import state ─────────────────────────────────────────
  const [importOpen, setImportOpen]       = useState(false);
  const [importRows, setImportRows]       = useState<ImportRow[]>([]);
  const [importParsing, setImportParsing] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult]   = useState<{ success: number; failed: number } | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['products', search, page, showLowStock],
    queryFn: () => productService.getProducts({
      search: search || undefined,
      page,
      limit: 12,
      low_stock: showLowStock,
    }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => productService.deleteProduct(id),
    onSuccess: () => {
      toast.success('Produk berhasil dihapus');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setDeleteId(null);
    },
    onError: () => {
      toast.error('Gagal menghapus produk');
      setDeleteId(null);
    },
  });

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);

  // ── Handle file pilih → parse preview ───────────────────
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.csv')) {
      toast.error('Hanya file .csv yang didukung. Gunakan template yang disediakan.');
      return;
    }
    setImportParsing(true);
    setImportResult(null);
    try {
      const rows = await parseImportFile(file);
      setImportRows(rows);
      if (rows.length === 0) toast.error('File kosong atau tidak ada data yang valid');
    } catch {
      toast.error('Gagal membaca file. Pastikan format CSV benar.');
    } finally {
      setImportParsing(false);
      e.target.value = '';
    }
  };

  // ── Submit import: delegasi ke productService.importProducts ───────────────
  const handleImportSubmit = async () => {
    const validRows = importRows.filter(r => r.valid);
    if (validRows.length === 0) { toast.error('Tidak ada baris yang valid untuk diimport'); return; }
    setImportLoading(true);
    try {
      const result = await productService.importProducts(validRows);
      setImportResult({ success: result.success, failed: result.failed });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      if (result.success > 0) toast.success(`${result.success} produk berhasil diimport`);
      if (result.failed > 0)  toast.error(`${result.failed} produk gagal diimport`);
    } catch {
      toast.error('Import gagal. Coba lagi.');
    } finally {
      setImportLoading(false);
    }
  };

  const handleImportClose = () => {
    setImportOpen(false);
    setImportRows([]);
    setImportResult(null);
  };

  const validCount   = importRows.filter(r => r.valid).length;
  const invalidCount = importRows.filter(r => !r.valid).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Produk</h1>
          <p className="text-muted-foreground">
            Kelola katalog produk dan inventori
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setImportRows([]); setImportResult(null); setImportOpen(true); }}>
            <Upload className="mr-2 h-4 w-4" />
            Import
          </Button>
          <Button asChild>
            <NavLink to="/admin/products/new">
              <Plus className="mr-2 h-4 w-4" />
              Tambah Produk
            </NavLink>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari produk..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={showLowStock ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowLowStock(!showLowStock)}
              >
                <AlertTriangle className="mr-2 h-4 w-4" />
                Stok Menipis
              </Button>
              <Button variant="outline" size="sm">
                <Filter className="mr-2 h-4 w-4" />
                Filter
              </Button>
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Ekspor
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Products Grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <div className="h-48 bg-muted" />
              <CardContent className="p-4 space-y-3">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : data?.products.length === 0 ? (
        <Card className="p-12 text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Produk tidak ditemukan</h3>
          <p className="text-muted-foreground mb-4">
            {search ? 'Coba ubah kata kunci pencarian' : 'Mulai dengan menambahkan produk pertama Anda'}
          </p>
          {!search && (
            <Button asChild>
              <NavLink to="/admin/products/new">
                <Plus className="mr-2 h-4 w-4" />
                Tambah Produk
              </NavLink>
            </Button>
          )}
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data?.products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onDelete={(id) => setDeleteId(id)}
                formatCurrency={formatCurrency}
              />
            ))}
          </div>

          {/* Pagination */}
          {data?.pagination && data.pagination.totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Sebelumnya
              </Button>
              <span className="flex items-center px-4 text-sm text-muted-foreground">
                Halaman {page} dari {data.pagination.totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setPage(p => Math.min(data.pagination.totalPages, p + 1))}
                disabled={page === data.pagination.totalPages}
              >
                Berikutnya
              </Button>
            </div>
          )}
        </>
      )}

      {/* Delete confirm dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Produk?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan. Produk akan dihapus secara permanen dari katalog.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Menghapus...</>
              ) : 'Hapus'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ════════════════════════════════════════════════════════
          IMPORT DIALOG
      ════════════════════════════════════════════════════════ */}
      <Dialog open={importOpen} onOpenChange={(o) => { if (!o) handleImportClose(); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
              Import Produk dari CSV
            </DialogTitle>
            <DialogDescription>
              Upload file CSV sesuai template. Produk akan ditambahkan ke katalog secara batch.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">

            {/* Step 1: Download template + upload */}
            {!importResult && (
              <div className="grid sm:grid-cols-2 gap-4">
                {/* Download template */}
                <div className="rounded-xl border-2 border-dashed border-muted p-5 flex flex-col items-center text-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <Download className="h-6 w-6 text-blue-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">1. Download Template</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Gunakan template CSV ini untuk memastikan format data benar
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={downloadTemplate}>
                    <Download className="mr-2 h-4 w-4" />
                    Download template_import_produk.csv
                  </Button>
                </div>

                {/* Upload file */}
                <div
                  className="rounded-xl border-2 border-dashed border-muted p-5 flex flex-col items-center text-center gap-3 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                  onClick={() => importFileRef.current?.click()}
                >
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    {importParsing
                      ? <Loader2 className="h-6 w-6 text-emerald-500 animate-spin" />
                      : <Upload className="h-6 w-6 text-emerald-500" />}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">2. Upload File CSV</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {importParsing ? 'Membaca file...' : 'Klik untuk pilih file .csv'}
                    </p>
                  </div>
                  <input ref={importFileRef} type="file" accept=".csv" className="hidden" onChange={handleImportFile} />
                  {importRows.length > 0 && (
                    <div className="flex gap-2">
                      {validCount > 0 && (
                        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-0">
                          <CheckCircle2 className="h-3 w-3 mr-1" />{validCount} valid
                        </Badge>
                      )}
                      {invalidCount > 0 && (
                        <Badge className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 border-0">
                          <XCircle className="h-3 w-3 mr-1" />{invalidCount} error
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Format info */}
            {importRows.length === 0 && !importResult && (
              <div className="rounded-lg bg-muted/50 p-4 text-xs text-muted-foreground space-y-1.5">
                <p className="font-semibold text-foreground text-sm">Format Kolom CSV (urutan wajib diikuti):</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {[
                    ['A', 'Nama Produk', 'wajib'],
                    ['B', 'SKU', 'wajib, unik'],
                    ['C', 'Deskripsi', 'opsional'],
                    ['D', 'Nama Kategori', 'opsional'],
                    ['E', 'Pcs per Pack', 'angka'],
                    ['F', 'Pack per Karton', 'wajib, angka'],
                    ['G', 'Stok Karton', 'angka, default 0'],
                    ['H', 'Reorder Level', 'angka, default 0'],
                    ['I', 'Berat gram/pcs', 'opsional'],
                    ['J', 'Harga Reseller/karton', 'wajib, angka'],
                    ['K', 'Harga Agent/karton', 'opsional'],
                    ['L', 'URL Foto (Cloudinary)', 'opsional, https://...'],
                  ].map(([col, desc, note]) => (
                    <div key={col} className="flex gap-1.5 items-baseline">
                      <span className="font-mono font-bold text-primary w-4 shrink-0">{col}</span>
                      <span>{desc}</span>
                      <span className="text-muted-foreground/70 italic">— {note}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Preview table */}
            {importRows.length > 0 && !importResult && (
              <div className="rounded-lg border overflow-hidden">
                <div className="bg-muted/50 px-4 py-2.5 flex items-center justify-between">
                  <span className="text-sm font-medium">Preview Data ({importRows.length} baris)</span>
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                    onClick={() => { setImportRows([]); if (importFileRef.current) importFileRef.current.value = ''; }}
                  >
                    Ganti file
                  </button>
                </div>
                <div className="overflow-x-auto max-h-72">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-background border-b">
                      <tr>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground w-10">#</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Nama</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">SKU</th>
                        <th className="text-right py-2 px-3 font-medium text-muted-foreground">Stok</th>
                        <th className="text-right py-2 px-3 font-medium text-muted-foreground">Harga Reseller</th>
                        <th className="text-right py-2 px-3 font-medium text-muted-foreground">Harga Agent</th>
                        <th className="text-center py-2 px-3 font-medium text-muted-foreground w-14">Foto</th>
                        <th className="text-center py-2 px-3 font-medium text-muted-foreground w-16">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importRows.map((row) => (
                        <tr key={row.row} className={cn(
                          'border-b last:border-0',
                          row.valid ? 'hover:bg-muted/30' : 'bg-red-50/50 dark:bg-red-950/20'
                        )}>
                          <td className="py-2 px-3 text-muted-foreground">{row.row}</td>
                          <td className="py-2 px-3 font-medium max-w-[160px] truncate" title={row.name}>{row.name || '—'}</td>
                          <td className="py-2 px-3 font-mono text-muted-foreground">{row.sku || '—'}</td>
                          <td className="py-2 px-3 text-right">{row.stock_karton} karton</td>
                          <td className="py-2 px-3 text-right font-medium">
                            {row.price_reseller ? formatCurrency(row.price_reseller) : '—'}
                          </td>
                          <td className="py-2 px-3 text-right text-muted-foreground">
                            {row.price_agent ? formatCurrency(row.price_agent) : '—'}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {row.image_url ? (
                              <img
                                src={row.image_url}
                                alt={row.name}
                                className="w-8 h-8 rounded object-cover mx-auto border"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {row.valid ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                            ) : (
                              <div title={row.errors.join(', ')}>
                                <XCircle className="h-4 w-4 text-red-500 mx-auto" />
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {invalidCount > 0 && (
                  <div className="bg-red-50 dark:bg-red-950/20 px-4 py-2.5 border-t">
                    <p className="text-xs text-red-700 dark:text-red-400">
                      ⚠️ {invalidCount} baris memiliki error dan tidak akan diimport. Hover ikon ✗ untuk lihat detail error.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Result */}
            {importResult && (
              <div className="rounded-xl border p-6 text-center space-y-4">
                <div className={cn(
                  'w-16 h-16 rounded-full mx-auto flex items-center justify-center',
                  importResult.failed === 0 ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-amber-100 dark:bg-amber-900/30'
                )}>
                  {importResult.failed === 0
                    ? <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                    : <AlertTriangle className="h-8 w-8 text-amber-500" />}
                </div>
                <div>
                  <p className="text-lg font-bold">Import Selesai</p>
                  <p className="text-muted-foreground text-sm mt-1">
                    {importResult.success > 0 && <span className="text-emerald-600 font-medium">{importResult.success} produk berhasil ditambahkan</span>}
                    {importResult.success > 0 && importResult.failed > 0 && ', '}
                    {importResult.failed > 0 && <span className="text-red-600 font-medium">{importResult.failed} produk gagal</span>}
                  </p>
                </div>
                <Button onClick={handleImportClose}>Tutup</Button>
              </div>
            )}
          </div>

          {/* Footer actions */}
          {!importResult && (
            <DialogFooter className="border-t pt-4 mt-2">
              <Button variant="outline" onClick={handleImportClose}>Batal</Button>
              <Button
                onClick={handleImportSubmit}
                disabled={validCount === 0 || importLoading}
              >
                {importLoading
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Mengimport {validCount} produk...</>
                  : <><Upload className="mr-2 h-4 w-4" />Import {validCount} Produk Valid</>}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProductCard({ 
  product, 
  onDelete,
  formatCurrency 
}: { 
  product: Product; 
  onDelete: (id: string) => void;
  formatCurrency: (value: number) => string;
}) {
  const isLowStock = product.stock_quantity <= product.reorder_level;
  const isOutOfStock = product.stock_quantity === 0;

  const TIER_ORDER = ['reseller', 'agent'];
  const displayPrice = product.price || (() => {
    if (!product.price_tiers?.length) return 0;
    const tier = TIER_ORDER.map(t => product.price_tiers?.find((pt: any) => pt.tier === t)).find(Boolean);
    return tier?.price_per_karton || 0;
  })();

  return (
    <Card className="overflow-hidden group">
      <div className="relative aspect-square bg-muted">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="h-16 w-16 text-muted-foreground/50" />
          </div>
        )}
        {(isLowStock || isOutOfStock) && (
          <div className="absolute top-2 left-2">
            <Badge variant={isOutOfStock ? 'destructive' : 'secondary'}>
              {isOutOfStock ? 'Habis' : 'Stok Menipis'}
            </Badge>
          </div>
        )}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <NavLink to={`/admin/products/edit/${product.id}`}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </NavLink>
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="text-destructive"
                onClick={() => onDelete(product.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Hapus
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-medium truncate">{product.name}</h3>
            <p className="text-sm text-muted-foreground">{product.sku}</p>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div>
            <p className="text-lg font-bold">{formatCurrency(displayPrice)}</p>
            <p className="text-xs text-muted-foreground">
              Grosir: {formatCurrency(product.wholesale_price || displayPrice)}
            </p>
          </div>
          <div className="text-right">
            <p className={cn(
              "text-sm font-medium",
              isOutOfStock ? "text-destructive" :
              isLowStock ? "text-amber-500" : "text-emerald-500"
            )}>
              {product.stock_quantity} {product.unit_type || "karton"}
            </p>
            <p className="text-xs text-muted-foreground">tersedia</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
