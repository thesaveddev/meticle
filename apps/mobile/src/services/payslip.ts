import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { authHeader, myPayslipUrl } from './api'

/**
 * Download the carer's payslip PDF and hand it to the OS share sheet.
 *
 * The payslip is rendered by the API rather than on the device, so the carer
 * gets exactly the same document here, on the web dashboard, and as the PDF
 * emailed to them at the end of the pay period. One format, one set of figures.
 *
 * Returns false when the payslip could not be downloaded (for example there are
 * no completed calls in the period), so the screen can tell the carer.
 */
export async function downloadAndSharePayslip(accessToken: string, from: string, to: string): Promise<boolean> {
  try {
    const destination = new File(Paths.cache, `payslip-${from.slice(0, 7)}.pdf`)
    const file = await File.downloadFileAsync(myPayslipUrl(from, to), destination, {
      headers: authHeader(accessToken),
      idempotent: true,
    })

    if (!(await Sharing.isAvailableAsync())) return false

    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Save payslip',
      UTI: 'com.adobe.pdf',
    })
    return true
  } catch {
    return false
  }
}
